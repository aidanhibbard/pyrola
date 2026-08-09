import { toast } from 'vue-sonner'
import { ref, shallowRef } from 'vue'
import type { ChatStatus, FileUIPart } from 'ai'
import type { ChatAttention } from '@/types/chat/chat-attention'
import type { HarnessEvent } from '@/types/harness/harness-event'
import type { SubagentEntry } from '@/types/harness/subagent-entry'
import type { ContextMention } from '@/types/harness/context-mention'
import type { ToolRun } from '@/types/harness/tool-run'
import type { PyrolaChatMode, PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import type { ReasoningLevel } from '@/types/models/reasoning-level'
import type { PermissionCapabilityKey, PermissionLevel, PermissionRecord } from '@/types/harness/permission'
import useChatStore from '@/composables/use-chat-store'
import useContextUsage from '@/composables/use-context-usage'
import useChatContextBudgetSync from '@/composables/use-chat-context-budget-sync'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import runOrchestrator, {
  mapMetaStatusToChatStatus,
  resumeOrchestrator,
} from '@/services/harness/orchestrator'
import {
  listPendingApprovalsForChat,
  resolveApproval,
  type ApprovalResolution,
} from '@/services/harness/approval-gate'
import { type PendingApprovalView } from '@/services/harness/gate-tool-permission'
import {
  listPendingMcpAuthForChat,
  rejectPendingMcpAuthForChat,
  resolveMcpAuth,
  resolveMcpAuthForServer,
  type McpAuthResolution,
} from '@/services/mcp/mcp-auth-gate'
import { requestQuestion } from '@/services/harness/question-gate'
import type { PendingMcpAuthView } from '@/types/chat/pending-mcp-auth'
import useMcpServers from '@/composables/use-mcp-servers'
import { listEffectiveMcpServers } from '@/services/mcp/merge-mcp-config'
import { parsePermissionRecords } from '@/services/harness/permission-policy'
import useFleetSidebar from '@/composables/use-fleet-sidebar'
import listConfiguredProviders from '@/services/providers/list-configured-providers'
import parseModelRef from '@/utils/parse-model-ref'
import mapSubagentResultStatus from '@/utils/map-subagent-result-status'
import { createChat, updateChatMeta } from '@/services/pyrola/pyrola-tauri'
import {
  abort as abortSubagentsForChat,
  abortOne,
  clearPendingBackgroundResume,
  clearTurnResponseMessages,
  hasPendingBackgroundResume,
  hasRunningSubagentsForChat,
  listDeliverableBackgroundResults,
} from '@/services/harness/subagent-registry'
import { killShellsForChat } from '@/services/harness/agent-shell-registry'
import compactSession from '@/services/harness/compact-session'
import writeHandoff from '@/services/harness/write-handoff'
import { setPendingChatMessage } from '@/services/chat/pending-message'
import chatRouteFor from '@/utils/chat-route-for'
import formatUnknownError from '@/utils/format-unknown-error'
import shouldFlushBackgroundSubagentResume from '@/utils/should-flush-background-subagent-resume'
import router from '@/router'

export type AgentHarnessOptions = {
  projectSlug: string
  chatId: string
  projectRoot: string
  projectName: string
  standalone?: boolean
}

export type { ToolRun } from '@/types/harness/tool-run'
export type { SubagentEntry } from '@/types/harness/subagent-entry'
export type { ApprovalResolution } from '@/services/harness/approval-gate'
export type { PendingApprovalView } from '@/services/harness/gate-tool-permission'
export type { McpAuthResolution } from '@/services/mcp/mcp-auth-gate'
export type { PendingMcpAuthView } from '@/types/chat/pending-mcp-auth'

type AgentHarness = ReturnType<typeof createAgentHarness>

const harnessCache = new Map<string, AgentHarness>()

const makeHarnessKey = (projectSlug: string, chatId: string): string =>
  `${projectSlug}::${chatId}`

export const dropAgentHarness = (projectSlug: string, chatId: string): void => {
  const key = makeHarnessKey(projectSlug, chatId)
  const existing = harnessCache.get(key)
  harnessCache.delete(key)
  if (existing) {
    existing.stop().catch(() => undefined)
  }
}

export const resetAgentHarnessCacheForTests = (): void => {
  harnessCache.clear()
}

const createAgentHarness = (options: AgentHarnessOptions) => {
  const chatStore = useChatStore()
  const session = chatStore.forChat(options.projectSlug, options.chatId)
  const config = usePyrolaConfig()
  const contextUsage = useContextUsage()
  const contextBudgetSync = useChatContextBudgetSync()
  const fleetSidebar = useFleetSidebar()

  const status = ref<ChatStatus>('ready')
  const error = ref<string | null>(null)
  const pendingApprovals = shallowRef<PendingApprovalView[]>([])
  const pendingMcpAuth = shallowRef<PendingMcpAuthView[]>([])
  const toolRuns = shallowRef<ToolRun[]>([])
  const subagents = shallowRef<SubagentEntry[]>([])
  const abortController = ref<AbortController | null>(null)
  const liveEvents = ref<HarnessEvent[]>([])
  const sessionPermissionLevel = ref<PermissionLevel | null>(null)
  const lastRunConfig = ref<{
    mode: PyrolaChatMode
    model: string
    reasoning?: ReasoningLevel
    mentions: ContextMention[]
    effectiveSettings: PyrolaSettings
  } | null>(null)
  const resumingBackgroundBatch = ref(false)
  let mcpAuthPollTimer: ReturnType<typeof setInterval> | null = null

  const mcpServers = useMcpServers()

  const refreshSidebar = (): void => {
    fleetSidebar.refreshSlug(options.projectSlug).catch((err) => {
      toast.error('Failed to refresh sidebar', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    })
  }

  const setChatAttention = (attention: ChatAttention): void => {
    updateChatMeta(options.projectSlug, options.chatId, { attention })
      .then(() => {
        session.patchMeta({ attention })
        refreshSidebar()
      })
      .catch((err) => {
        toast.error('Failed to update chat attention', {
          description: err instanceof Error ? err.message : 'Unknown error',
        })
      })
  }

  const maybeClearAttentionWhenGatesEmpty = (): void => {
    if (pendingApprovals.value.length > 0) {
      return
    }
    if (pendingMcpAuth.value.length > 0) {
      return
    }
    if (session.pendingQuestion.value) {
      return
    }
    setChatAttention(null)
  }

  const syncPendingMcpAuth = (): void => {
    const next = listPendingMcpAuthForChat(options.chatId).map((entry) => ({
      chatId: entry.chatId,
      toolCallId: entry.toolCallId,
      serverId: entry.serverId,
      kind: entry.kind,
      title: entry.title,
      detail: entry.detail,
      subagentId: entry.subagentId,
      subagentLabel: entry.subagentLabel,
    }))
    const hadPending = pendingMcpAuth.value.length > 0
    pendingMcpAuth.value = next
    if (next.length > 0) {
      setChatAttention('needs_mcp_auth')
      return
    }
    if (hadPending) {
      maybeClearAttentionWhenGatesEmpty()
    }
  }

  const stopMcpAuthPolling = (): void => {
    if (!mcpAuthPollTimer) {
      return
    }
    clearInterval(mcpAuthPollTimer)
    mcpAuthPollTimer = null
  }

  const startMcpAuthPolling = (): void => {
    if (mcpAuthPollTimer) {
      return
    }
    mcpAuthPollTimer = setInterval(() => {
      syncPendingMcpAuth()
      const live =
        status.value === 'streaming' ||
        status.value === 'submitted' ||
        pendingMcpAuth.value.length > 0
      if (!live) {
        stopMcpAuthPolling()
      }
    }, 250)
  }

  const applyTurnEndAttention = (outcome: 'success' | 'error'): void => {
    const active = chatStore.isSessionActive(options.projectSlug, options.chatId)
    if (outcome === 'success') {
      setChatAttention(active ? null : 'completed')
      return
    }
    if (!active) {
      setChatAttention('error')
    }
  }

  const persistPermission = async (
    capability: PermissionCapabilityKey,
    verdict: 'allow' | 'deny',
    scope: 'workspace' | 'always',
  ): Promise<void> => {
    const tab = scope === 'workspace' ? 'project' : 'personal'
    if (tab === 'project' && !config.activeRootPath.value) {
      toast.error('Cannot save workspace permission', {
        description: 'No active project is open.',
      })
      return
    }
    const settings = config.getScopeSettings(tab)
    const existing = parsePermissionRecords(settings['agent.permissions'])
    const idx = existing.findIndex((r) => r.capability === capability)
    const record: PermissionRecord = { capability, verdict, scope }
    const updated: PermissionRecord[] =
      idx >= 0 ? existing.map((r, i) => (i === idx ? record : r)) : [...existing, record]
    await config.updateSetting(tab, 'agent.permissions', updated)
  }

  const resolveApprovalDecision = (toolCallId: string, resolution: ApprovalResolution): void => {
    resolveApproval(toolCallId, resolution)
    pendingApprovals.value = pendingApprovals.value.filter(
      (item) => item.toolCallId !== toolCallId,
    )
    maybeClearAttentionWhenGatesEmpty()
  }

  const resolveMcpAuthDecision = (
    toolCallId: string,
    resolution: McpAuthResolution,
  ): void => {
    resolveMcpAuth(toolCallId, resolution)
    syncPendingMcpAuth()
    maybeClearAttentionWhenGatesEmpty()
  }

  const confirmAsOriginForChat = async (origin: string): Promise<boolean> => {
    const answer = await requestQuestion(
      options.chatId,
      `mcp-as-confirm-${crypto.randomUUID()}`,
      `Trust OAuth authorization server origin ${origin}? Only confirm origins you trust.`,
      ['Trust', 'Cancel'],
    )
    return answer === 'Trust'
  }

  const authenticatePendingMcpAuth = async (toolCallId: string): Promise<void> => {
    const entry =
      pendingMcpAuth.value.find((item) => item.toolCallId === toolCallId) ??
      listPendingMcpAuthForChat(options.chatId).find((item) => item.toolCallId === toolCallId)
    if (!entry) {
      toast.error('MCP authentication request expired')
      return
    }

    const rootPath = options.standalone ? null : options.projectRoot
    if (
      Object.keys(mcpServers.personalMcp.value.servers).length === 0 &&
      Object.keys(mcpServers.projectMcp.value.servers).length === 0
    ) {
      try {
        await mcpServers.loadConfigs(rootPath)
      } catch (error) {
        toast.error('Failed to load MCP config', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
        return
      }
    }

    const effective = listEffectiveMcpServers(
      mcpServers.personalMcp.value,
      mcpServers.projectMcp.value,
    )
    const server = effective.find((item) => item.id === entry.serverId)
    if (!server) {
      toast.error('MCP server not found', {
        description: entry.serverId,
      })
      return
    }

    try {
      await mcpServers.authenticateServer(entry.serverId, server.config, {
        confirmAuthorizationServerOrigin: confirmAsOriginForChat,
      })
      resolveMcpAuthForServer(entry.serverId, { action: 'authenticated' })
      syncPendingMcpAuth()
      maybeClearAttentionWhenGatesEmpty()
    } catch (error) {
      if (!(error instanceof Error)) {
        toast.error('MCP authentication failed', {
          description: String(error),
        })
      }
    }
  }

  const setPermissionLevel = (level: PermissionLevel | null): void => {
    sessionPermissionLevel.value = level
  }

  const restorePendingApprovals = (): void => {
    pendingApprovals.value = listPendingApprovalsForChat(options.chatId).map((entry) => ({
      toolCallId: entry.toolCallId,
      name: entry.name,
      kind: entry.kind,
      title: entry.title,
      detail: entry.detail,
      unsandboxed: entry.unsandboxed,
      allowedScopes: entry.allowedScopes,
      diff: entry.diff,
    }))
    syncPendingMcpAuth()
    if (pendingMcpAuth.value.length > 0) {
      startMcpAuthPolling()
    }
  }

  const handleEvent = (event: HarnessEvent): void => {
    liveEvents.value = [...liveEvents.value, event]
    if (event.type === 'text-delta') {
      session.appendLocalTextDelta(event.delta, event.messageId, event.stepId)
      status.value = 'streaming'
    }
    if (event.type === 'reasoning-delta') {
      session.appendLocalReasoningDelta(event.delta, event.messageId, event.stepId)
      status.value = 'streaming'
    }
    if (event.type === 'tool-input-start') {
      const existing = toolRuns.value.find(
        (item) => item.toolCallId === event.toolCallId,
      )
      if (!existing || existing.status === 'running') {
        const run: ToolRun = {
          toolCallId: event.toolCallId,
          name: event.name,
          status: 'running',
          args: existing?.args,
        }
        toolRuns.value = [
          ...toolRuns.value.filter((item) => item.toolCallId !== event.toolCallId),
          run,
        ]
        session.upsertLocalToolRun(run)
        status.value = 'streaming'
      }
    }
    if (event.type === 'tool-start') {
      const run: ToolRun = {
        toolCallId: event.toolCallId,
        name: event.name,
        status: 'running',
        args: event.args,
      }
      toolRuns.value = [
        ...toolRuns.value.filter((item) => item.toolCallId !== event.toolCallId),
        run,
      ]
      session.upsertLocalToolRun(run)
      status.value = 'streaming'
      if (event.name === 'call_mcp_tool') {
        startMcpAuthPolling()
        syncPendingMcpAuth()
      }
    }
    if (event.type === 'tool-result') {
      syncPendingMcpAuth()
      const existing = toolRuns.value.find(
        (item) => item.toolCallId === event.toolCallId,
      )
      const run: ToolRun = {
        toolCallId: event.toolCallId,
        name: existing?.name ?? 'tool',
        status: event.isError ? 'error' : 'done',
        args: existing?.args,
        result: event.result,
        artifact: event.artifact ?? existing?.artifact,
        diffs: event.diffs ?? existing?.diffs,
      }
      toolRuns.value = toolRuns.value.map((item) =>
        item.toolCallId === event.toolCallId ? run : item,
      )
      session.upsertLocalToolRun(run)
    }
    if (event.type === 'todo-update') {
      session.appendLocalTodoUpdate(event.todos)
    }
    if (event.type === 'subagent-start') {
      const entry: SubagentEntry = {
        subagentId: event.subagentId,
        name: event.name,
        blocking: event.blocking,
        status: 'running',
        events: [],
      }
      subagents.value = [
        ...subagents.value.filter((item) => item.subagentId !== event.subagentId),
        entry,
      ]
      session.upsertLocalSubagentStart({
        subagentId: event.subagentId,
        toolCallId: event.toolCallId,
        name: event.name,
        blocking: event.blocking,
        prompt: event.prompt,
        model: event.model,
      })
    }
    if (event.type === 'subagent-event') {
      const targetId =
        event.subagentId ||
        [...subagents.value].reverse().find((item) => item.status === 'running')
          ?.subagentId
      if (targetId) {
        subagents.value = subagents.value.map((item) =>
          item.subagentId === targetId
            ? { ...item, events: [...item.events, event.event] }
            : item,
        )
        session.appendLocalSubagentToolEvent(targetId, event.event)
      }
    }
    if (event.type === 'pending-subagent') {
      session.setLocalSubagentPrompt(event.subagentId, event.prompt)
    }
    if (event.type === 'subagent-result') {
      const status = mapSubagentResultStatus(event.outcome, event.summary)
      subagents.value = subagents.value.map((item) =>
        item.subagentId === event.subagentId
          ? { ...item, status, summary: event.summary }
          : item,
      )
      session.completeLocalSubagent(event.subagentId, event.summary, status)
      maybeFlushBackgroundSubagentResume()
    }
    if (event.type === 'question-request') {
      session.setPendingQuestion({
        toolCallId: event.toolCallId,
        question: event.question,
        options: event.options,
      })
      setChatAttention('needs_input')
    }
    if (event.type === 'step-start') {
      session.startAgentStep(event.stepId)
    }
    if (event.type === 'step-finish') {
      session.finishAgentStep()
    }
    if (event.type === 'tool-pending-approval') {
      const view: PendingApprovalView = {
        toolCallId: event.toolCallId,
        name: event.name,
        kind: event.kind,
        title: event.title,
        detail: event.detail,
        unsandboxed: event.unsandboxed,
        allowedScopes: event.allowedScopes,
        diff: event.diff,
      }
      pendingApprovals.value = [...pendingApprovals.value, view]
      setChatAttention('needs_approval')
    }
    if (event.type === 'context-budget') {
      contextUsage.setBudget(
        {
          modelId: event.modelId,
          used: event.used,
          promptUsed: event.promptUsed,
          limit: event.limit,
          reservedOutput: event.reservedOutput,
          safetyBuffer: event.safetyBuffer,
          free: event.free,
          buckets: event.buckets,
        },
        { clearProviderFill: true },
      )
    }
    if (event.type === 'context-usage') {
      contextUsage.setLastStepUsage({
        promptTokens: event.promptTokens,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        cacheReadTokens: event.cacheReadTokens,
        cacheWriteTokens: event.cacheWriteTokens,
      })
      // Recount from timeline so Conversation includes tool I/O from this step.
      contextBudgetSync.refreshContextBudget().catch((error) => {
        toast.error('Failed to refresh context usage', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    }
    if (event.type === 'chat-status-changed') {
      status.value = mapMetaStatusToChatStatus(event.status, false)
      session.patchMeta({ status: event.status })
      refreshSidebar()
      if (event.status === 'idle') {
        maybeFlushBackgroundSubagentResume()
      }
    }
    if (event.type === 'chat-meta-changed') {
      if (
        event.projectSlug === options.projectSlug &&
        event.chatId === options.chatId
      ) {
        session.patchMeta(event.patch)
      }
      refreshSidebar()
    }
    if (event.type === 'turn-aborted') {
      status.value = 'ready'
      session.clearPendingQuestion()
      session.finishAgentTurn()
    }
  }

  const submitAnswer = (toolCallId: string, answer: string): void => {
    session.submitAnswer(toolCallId, answer)
    maybeClearAttentionWhenGatesEmpty()
  }

  const maybeFlushBackgroundSubagentResume = (): void => {
    const action = shouldFlushBackgroundSubagentResume({
      parentBusy:
        status.value === 'streaming' ||
        status.value === 'submitted' ||
        resumingBackgroundBatch.value,
      hasPending: hasPendingBackgroundResume(options.chatId),
      hasRunning: hasRunningSubagentsForChat(options.chatId),
      deliverableCount: listDeliverableBackgroundResults(options.chatId).length,
    })

    if (action === 'clear') {
      clearPendingBackgroundResume(options.chatId)
      clearTurnResponseMessages(options.chatId)
      updateChatMeta(options.projectSlug, options.chatId, { status: 'idle' })
        .then(() => {
          session.patchMeta({ status: 'idle' })
          refreshSidebar()
        })
        .catch((err) => {
          toast.error('Failed to update chat status', {
            description: err instanceof Error ? err.message : 'Unknown error',
          })
        })
      return
    }

    if (action !== 'resume') {
      return
    }

    resumeAfterBackgroundSubagents().catch((err) => {
      toast.error('Agent resume failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    })
  }

  const resumeAfterBackgroundSubagents = async (): Promise<void> => {
    if (resumingBackgroundBatch.value) {
      return
    }

    const completedResults = listDeliverableBackgroundResults(options.chatId)
    const cfg = lastRunConfig.value
    if (completedResults.length === 0 || !cfg) {
      return
    }

    if (!cfg.model) {
      toast.error('Select a model before resuming')
      return
    }

    const parsedModel = parseModelRef(cfg.model)
    if (!parsedModel) {
      toast.error('Select a valid model before resuming')
      return
    }

    resumingBackgroundBatch.value = true
    error.value = null
    status.value = 'submitted'

    const turnId = crypto.randomUUID()
    session.startAgentTurn(turnId)

    const controller = new AbortController()
    abortController.value = controller

    try {
      await resumeOrchestrator({
        projectSlug: options.projectSlug,
        chatId: options.chatId,
        projectRoot: options.projectRoot,
        projectName: options.projectName,
        mode: cfg.mode,
        modelId: parsedModel.modelId,
        providerId: parsedModel.providerId,
        settings: cfg.effectiveSettings,
        messages: session.messages.value,
        timeline: session.timeline.value,
        mentions: cfg.mentions,
        signal: controller.signal,
        onEvent: handleEvent,
        assistantId: turnId,
        completedResults,
        skipUserPersist: true,
        permissionLevel: sessionPermissionLevel.value ?? undefined,
        persistPermission,
        reasoning: cfg.reasoning,
      })
      status.value = 'ready'
      session.finishAgentTurn()
      applyTurnEndAttention('success')
      await fleetSidebar.refreshSlug(options.projectSlug)
    } catch (err) {
      const aborted = controller.signal.aborted
      if (aborted) {
        status.value = 'ready'
        session.finishAgentTurn()
        await fleetSidebar.refreshSlug(options.projectSlug)
        return
      }
      error.value = err instanceof Error ? err.message : 'Unknown error'
      status.value = 'error'
      session.finishAgentTurn()
      applyTurnEndAttention('error')
      toast.error('Agent resume failed', {
        description: error.value,
      })
      await fleetSidebar.refreshSlug(options.projectSlug)
    } finally {
      abortController.value = null
      resumingBackgroundBatch.value = false
    }
  }

  const send = async (args: {
    text: string
    mode: PyrolaChatMode
    model: string
    reasoning?: ReasoningLevel
    mentions?: ContextMention[]
    files?: FileUIPart[]
    skipUserMessage?: boolean
    skipUserPersist?: boolean
  }): Promise<void> => {
    if (status.value === 'streaming' || status.value === 'submitted') {
      return
    }

    if (!args.model) {
      toast.error('Select a model before sending')
      return
    }

    if (!config.hydrated.value) {
      toast.error('Settings are still loading')
      return
    }

    if (listConfiguredProviders(config.effectiveSettings.value).length === 0) {
      toast.error('No provider configured', {
        description: 'Add a provider in Settings.',
      })
      return
    }

    const parsedModel = parseModelRef(args.model)
    if (!parsedModel) {
      toast.error('Select a valid model before sending')
      return
    }

    error.value = null
    status.value = 'submitted'
    toolRuns.value = []
    subagents.value = []

    lastRunConfig.value = {
      mode: args.mode,
      model: args.model,
      reasoning: args.reasoning,
      mentions: args.mentions ?? [],
      effectiveSettings: config.effectiveSettings.value,
    }
    contextBudgetSync.setDraftMentions(args.mentions ?? [])

    if (!args.skipUserMessage) {
      const fileParts = args.files ?? []

      const parts: Array<
        | { type: 'text'; text: string }
        | { type: 'file'; mediaType: string; url: string; filename?: string }
      > = [{ type: 'text', text: args.text }]

      // Always keep file parts on the UI message so the thread can show
      // thumbnails. Non-vision models get text placeholders later, only for
      // convertToModelMessages in the orchestrator.
      for (const file of fileParts) {
        const url = file.url
        if (url?.startsWith('file://')) {
          parts.push({
            type: 'text',
            text: `[Attachment unavailable: ${file.filename || url}]`,
          })
          continue
        }

        if (url) {
          parts.push({
            type: 'file',
            mediaType: file.mediaType || 'image/png',
            url,
            filename: file.filename,
          })
        }
      }

      session.appendLocalMessage({
        id: crypto.randomUUID(),
        role: 'user',
        parts,
        metadata: {
          createdAt: new Date().toISOString(),
          model: args.model,
        },
      })
    }

    const turnId = crypto.randomUUID()
    session.startAgentTurn(turnId)

    const controller = new AbortController()
    abortController.value = controller

    try {
      await runOrchestrator({
        projectSlug: options.projectSlug,
        chatId: options.chatId,
        projectRoot: options.projectRoot,
        projectName: options.projectName,
        mode: args.mode,
        modelId: parsedModel.modelId,
        providerId: parsedModel.providerId,
        settings: config.effectiveSettings.value,
        messages: session.messages.value,
        timeline: session.timeline.value,
        userText: args.text,
        mentions: args.mentions ?? [],
        signal: controller.signal,
        onEvent: handleEvent,
        assistantId: turnId,
        skipUserPersist: args.skipUserPersist,
        standalone: options.standalone,
        permissionLevel: sessionPermissionLevel.value ?? undefined,
        persistPermission,
        reasoning: args.reasoning,
      })
      status.value = 'ready'
      session.finishAgentTurn()
      applyTurnEndAttention('success')
      await fleetSidebar.refreshSlug(options.projectSlug)
    } catch (err) {
      const aborted = controller.signal.aborted
      const timedOut =
        err instanceof Error &&
        (err.name === 'TimeoutError' || /timeout/i.test(err.message))
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (aborted) {
        status.value = 'ready'
        session.finishAgentTurn()
        await fleetSidebar.refreshSlug(options.projectSlug)
        return
      }
      error.value = message
      status.value = 'error'
      session.setAgentTurnError({
        kind: timedOut ? 'timeout' : 'error',
        message: timedOut
          ? 'The model took too long to respond.'
          : message.includes('No output generated')
            ? 'The model returned an empty response. Check your API key and model ID in Settings.'
            : message,
      })
      session.finishAgentTurn()
      applyTurnEndAttention('error')
      toast.error('Agent run failed', {
        description: error.value.includes('No output generated')
          ? 'The model returned an empty response. Check your Gateway API key and model ID in Settings.'
          : error.value,
      })
      await fleetSidebar.refreshSlug(options.projectSlug)
    } finally {
      contextBudgetSync.setDraftMentions([])
      abortController.value = null
    }
  }

  const submitEditMessage = async (args: {
    newContent: string
    mode: PyrolaChatMode
    model: string
    reasoning?: ReasoningLevel
  }): Promise<void> => {
    const messageId = chatStore.editingMessageId.value
    if (!messageId) {
      return
    }

    const text = args.newContent.trim()
    if (!text) {
      return
    }

    try {
      await session.truncateBeforeMessage(
        options.projectSlug,
        options.chatId,
        messageId,
      )
      chatStore.cancelEditMessage()
      await send({
        text,
        mode: args.mode,
        model: args.model,
        reasoning: args.reasoning,
      })
    } catch (err) {
      toast.error('Failed to edit message', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  const retryLastTurn = async (args: {
    mode: PyrolaChatMode
    model: string
    reasoning?: ReasoningLevel
  }): Promise<void> => {
    if (status.value === 'streaming' || status.value === 'submitted') {
      return
    }

    const lastUser = session.getLastUserMessage()
    if (!lastUser) {
      return
    }

    const text = lastUser.parts
      .filter((part) => part.type === 'text')
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('')
      .trim()
    if (!text) {
      return
    }

    try {
      await session.truncateAfterLastUserMessage(
        options.projectSlug,
        options.chatId,
      )
      await send({
        text,
        mode: args.mode,
        model: args.model,
        reasoning: args.reasoning,
        skipUserMessage: true,
        skipUserPersist: true,
      })
    } catch (err) {
      toast.error('Failed to retry', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  const stopSubagent = (subagentId: string): void => {
    abortOne(subagentId)
    session.completeLocalSubagent(subagentId, 'Stopped', 'stopped')
    subagents.value = subagents.value.map((item) =>
      item.subagentId === subagentId
        ? { ...item, status: 'stopped', summary: 'Stopped' }
        : item,
    )
    maybeFlushBackgroundSubagentResume()
  }

  const stop = async (): Promise<void> => {
    abortController.value?.abort()
    rejectPendingMcpAuthForChat(options.chatId)
    pendingMcpAuth.value = []
    stopMcpAuthPolling()
    abortSubagentsForChat(options.chatId)
    const runningIds = new Set(
      subagents.value
        .filter((item) => item.status === 'running')
        .map((item) => item.subagentId),
    )
    for (const subagentId of runningIds) {
      session.completeLocalSubagent(subagentId, 'Stopped', 'stopped')
    }
    if (runningIds.size > 0) {
      subagents.value = subagents.value.map((item) =>
        runningIds.has(item.subagentId)
          ? { ...item, status: 'stopped', summary: 'Stopped' }
          : item,
      )
    }
    status.value = 'ready'
    session.finishAgentTurn()
    try {
      await updateChatMeta(options.projectSlug, options.chatId, {
        status: 'idle',
      })
      session.patchMeta({ status: 'idle' })
      refreshSidebar()
    } catch (metaError) {
      toast.error('Failed to update chat status', {
        description:
          metaError instanceof Error ? metaError.message : 'Unknown error',
      })
    }
    try {
      await killShellsForChat(options.chatId)
    } catch (stopError) {
      toast.error('Failed to stop terminals', {
        description: stopError instanceof Error ? stopError.message : 'Unknown error',
      })
    }
  }

  const approve = (toolCallId: string): void => {
    resolveApprovalDecision(toolCallId, { approved: true, scope: 'once' })
  }

  const reject = (toolCallId: string): void => {
    resolveApprovalDecision(toolCallId, { approved: false, scope: 'once' })
  }

  const compactChat = async (focus?: string): Promise<void> => {
    if (status.value === 'streaming' || status.value === 'submitted') {
      toast.error('Cannot compact while agent is running', {
        description: 'Stop the agent first, then compact.',
      })
      return
    }

    const meta = session.meta.value
    if (!meta) {
      toast.error('Chat is not ready yet')
      return
    }

    const projectRoot = options.projectRoot
    if (!projectRoot) {
      toast.error('No project root available for compaction')
      return
    }

    try {
      const result = await compactSession({
        projectSlug: options.projectSlug,
        chatId: options.chatId,
        projectRoot,
        settings: config.effectiveSettings.value,
        messages: session.messages.value,
        focus,
        frozenSystem: undefined,
        chatModel: meta.model,
      })
      session.appendLocalCompaction(result.summary, focus ?? null)
      session.patchMetaActiveContext({
        checkpointLineId: result.checkpointLineId,
        includeFromCreatedAt: result.includeFromCreatedAt,
        summary: result.summary,
      })
      contextUsage.clearLastStepUsage()
      toast.success('Context compacted', {
        description: 'Conversation history has been summarized.',
      })
    } catch (err) {
      toast.error('Compaction failed', {
        description: formatUnknownError(err),
      })
    }
  }

  const createHandoff = async (): Promise<void> => {
    if (status.value === 'streaming' || status.value === 'submitted') {
      toast.error('Cannot create handoff while agent is running', {
        description: 'Stop the agent first.',
      })
      return
    }

    const meta = session.meta.value
    if (!meta) {
      toast.error('Chat is not ready yet')
      return
    }

    const projectRoot = options.projectRoot

    let summary = meta.activeContext?.summary
    if (!summary) {
      try {
        const compactResult = await compactSession({
          projectSlug: options.projectSlug,
          chatId: options.chatId,
          projectRoot,
          settings: config.effectiveSettings.value,
          messages: session.messages.value,
          chatModel: meta.model,
        })
        summary = compactResult.summary
        session.appendLocalCompaction(compactResult.summary, null)
        session.patchMetaActiveContext({
          checkpointLineId: compactResult.checkpointLineId,
          includeFromCreatedAt: compactResult.includeFromCreatedAt,
          summary: compactResult.summary,
        })
      } catch (err) {
        toast.error('Handoff failed: could not generate summary', {
          description: formatUnknownError(err),
        })
        return
      }
    }

    try {
      await writeHandoff({
        summary,
        chatId: options.chatId,
      })
    } catch (err) {
      toast.error('Handoff failed: could not write file', {
        description: formatUnknownError(err),
      })
      return
    }

    try {
      const newChat = await createChat({
        projectSlug: options.projectSlug,
        projectRoot,
        mode: meta.mode,
        model: meta.model,
        title: `Handoff from ${meta.title}`,
      })

      setPendingChatMessage({
        text: `Continuing from handoff:\n\n${summary}`,
        mode: meta.mode,
        model: meta.model,
      })

      await router.push(chatRouteFor(options.projectSlug, newChat.id))
      toast.success('Handoff created', {
        description: 'New chat opened with context from previous session.',
      })
    } catch (err) {
      toast.error('Handoff failed: could not create new chat', {
        description: formatUnknownError(err),
      })
    }
  }

  return {
    status,
    error,
    pendingApprovals,
    pendingMcpAuth,
    sessionPermissionLevel,
    toolRuns,
    subagents,
    liveEvents,
    send,
    submitEditMessage,
    retryLastTurn,
    stop,
    stopSubagent,
    approve,
    reject,
    resolveApprovalDecision,
    resolveMcpAuthDecision,
    authenticatePendingMcpAuth,
    setPermissionLevel,
    submitAnswer,
    compactChat,
    createHandoff,
    restorePendingApprovals,
  }
}

export default (options: AgentHarnessOptions): AgentHarness => {
  const key = makeHarnessKey(options.projectSlug, options.chatId)
  const existing = harnessCache.get(key)
  if (existing) {
    return existing
  }
  const harness = createAgentHarness(options)
  harnessCache.set(key, harness)
  return harness
}
