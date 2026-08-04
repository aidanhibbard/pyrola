import { toast } from 'vue-sonner'
import { ref, shallowRef } from 'vue'
import type { ChatStatus } from 'ai'
import type { HarnessEvent } from '@/types/harness/harness-event'
import type { SubagentEntry } from '@/types/harness/subagent-entry'
import type { ContextMention } from '@/types/harness/context-mention'
import type { ToolRun } from '@/types/harness/tool-run'
import type { PyrolaChatMode, PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import type { PermissionCapabilityKey, PermissionLevel, PermissionRecord } from '@/types/harness/permission'
import useChatStore from '@/composables/use-chat-store'
import useContextUsage from '@/composables/use-context-usage'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import runOrchestrator, {
  mapMetaStatusToChatStatus,
  resumeOrchestrator,
} from '@/services/harness/orchestrator'
import { resolveApproval, type ApprovalResolution } from '@/services/harness/approval-gate'
import { type PendingApprovalView } from '@/services/harness/gate-tool-permission'
import { parsePermissionRecords } from '@/services/harness/permission-policy'
import useFleetSidebar from '@/composables/use-fleet-sidebar'
import parseModelRef from '@/utils/parse-model-ref'
import listConfiguredProviders from '@/services/providers/list-configured-providers'
import createModel from '@/services/providers/create-model'
import resolveModelVision from '@/services/harness/resolve-model-vision'
import { browserReadArtifact, createChat } from '@/services/pyrola/pyrola-tauri'
import type { FileUIPart } from 'ai'
import {
  abort as abortSubagentsForChat,
  abortOne,
  getSubagent,
} from '@/services/harness/subagent-registry'
import { killShellsForChat } from '@/services/harness/agent-shell-registry'
import compactSession from '@/services/harness/compact-session'
import writeHandoff from '@/services/harness/write-handoff'
import { setPendingChatMessage } from '@/services/chat/pending-message'
import chatRouteFor from '@/utils/chat-route-for'
import formatUnknownError from '@/utils/format-unknown-error'
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

export default (options: AgentHarnessOptions) => {
  const chatStore = useChatStore()
  const config = usePyrolaConfig()
  const contextUsage = useContextUsage()
  const fleetSidebar = useFleetSidebar()

  const status = ref<ChatStatus>('ready')
  const error = ref<string | null>(null)
  const pendingApprovals = shallowRef<PendingApprovalView[]>([])
  const toolRuns = shallowRef<ToolRun[]>([])
  const subagents = shallowRef<SubagentEntry[]>([])
  const abortController = ref<AbortController | null>(null)
  const liveEvents = ref<HarnessEvent[]>([])
  const sessionPermissionLevel = ref<PermissionLevel | null>(null)
  const lastRunConfig = ref<{
    mode: PyrolaChatMode
    model: string
    mentions: ContextMention[]
    effectiveSettings: PyrolaSettings
  } | null>(null)
  const resumingSubagents = new Set<string>()

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
  }

  const setPermissionLevel = (level: PermissionLevel | null): void => {
    sessionPermissionLevel.value = level
  }

  const handleEvent = (event: HarnessEvent): void => {
    liveEvents.value = [...liveEvents.value, event]
    if (event.type === 'text-delta') {
      chatStore.appendLocalTextDelta(event.delta, event.messageId, event.stepId)
      status.value = 'streaming'
    }
    if (event.type === 'reasoning-delta') {
      chatStore.appendLocalReasoningDelta(event.delta, event.messageId, event.stepId)
      status.value = 'streaming'
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
      chatStore.upsertLocalToolRun(run)
    }
    if (event.type === 'tool-result') {
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
      chatStore.upsertLocalToolRun(run)
    }
    if (event.type === 'todo-update') {
      chatStore.appendLocalTodoUpdate(event.todos)
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
      chatStore.upsertLocalSubagentStart({
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
        chatStore.appendLocalSubagentToolEvent(targetId, event.event)
      }
    }
    if (event.type === 'pending-subagent') {
      chatStore.setLocalSubagentPrompt(event.subagentId, event.prompt)
    }
    if (event.type === 'subagent-result') {
      subagents.value = subagents.value.map((item) =>
        item.subagentId === event.subagentId
          ? { ...item, status: 'done', summary: event.summary }
          : item,
      )
      chatStore.completeLocalSubagent(event.subagentId, event.summary)
      if (!event.blocking && !resumingSubagents.has(event.subagentId)) {
        resumingSubagents.add(event.subagentId)
        resumeAfterSubagent(event.subagentId, event.summary)
          .catch((err) => {
            toast.error('Agent resume failed', {
              description: err instanceof Error ? err.message : 'Unknown error',
            })
          })
          .finally(() => {
            resumingSubagents.delete(event.subagentId)
          })
      }
    }
    if (event.type === 'question-request') {
      chatStore.setPendingQuestion({
        toolCallId: event.toolCallId,
        question: event.question,
        options: event.options,
      })
    }
    if (event.type === 'step-start') {
      chatStore.startAgentStep(event.stepId)
    }
    if (event.type === 'step-finish') {
      chatStore.finishAgentStep()
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
    }
    if (event.type === 'context-budget') {
      contextUsage.setBudget({
        modelId: event.modelId,
        used: event.used,
        promptUsed: event.promptUsed,
        limit: event.limit,
        reservedOutput: event.reservedOutput,
        safetyBuffer: event.safetyBuffer,
        free: event.free,
        buckets: event.buckets,
      })
    }
    if (event.type === 'chat-status-changed') {
      status.value = mapMetaStatusToChatStatus(event.status, false)
    }
    if (event.type === 'chat-meta-changed') {
      if (
        event.projectSlug === options.projectSlug &&
        event.chatId === options.chatId &&
        event.patch.title
      ) {
        chatStore.patchMeta({ title: event.patch.title })
      }
      fleetSidebar.refreshSlug(options.projectSlug).catch((err) => {
        toast.error('Failed to refresh sidebar', {
          description: err instanceof Error ? err.message : 'Unknown error',
        })
      })
    }
    if (event.type === 'turn-aborted') {
      status.value = 'ready'
      chatStore.clearPendingQuestion()
    }
  }

  const submitAnswer = (toolCallId: string, answer: string): void => {
    chatStore.submitAnswer(toolCallId, answer)
  }

  const resumeAfterSubagent = async (
    subagentId: string,
    summary: string,
  ): Promise<void> => {
    if (status.value === 'streaming' || status.value === 'submitted') {
      return
    }

    const record = getSubagent(subagentId)
    const cfg = lastRunConfig.value
    if (!record || !cfg) {
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

    error.value = null
    status.value = 'submitted'

    const turnId = crypto.randomUUID()
    chatStore.startAgentTurn(turnId)

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
        messages: chatStore.messages.value,
        mentions: cfg.mentions,
        signal: controller.signal,
        onEvent: handleEvent,
        assistantId: turnId,
        toolCallId: record.toolCallId,
        completedResult: {
          subagentId,
          name: record.agentName,
          summary,
        },
        skipUserPersist: true,
        permissionLevel: sessionPermissionLevel.value ?? undefined,
        persistPermission,
      })
      status.value = 'ready'
      chatStore.finishAgentTurn()
      await fleetSidebar.refreshSlug(options.projectSlug)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      status.value = 'error'
      chatStore.finishAgentTurn()
      toast.error('Agent resume failed', {
        description: error.value,
      })
    } finally {
      abortController.value = null
    }
  }

  const send = async (args: {
    text: string
    mode: PyrolaChatMode
    model: string
    mentions?: ContextMention[]
    files?: import('ai').FileUIPart[]
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
      mentions: args.mentions ?? [],
      effectiveSettings: config.effectiveSettings.value,
    }

    if (!args.skipUserMessage) {
      const fileParts = args.files ?? []
      const modelInstance = await createModel({
        providerId: parsedModel.providerId,
        modelId: parsedModel.modelId,
        settings: config.effectiveSettings.value,
      })
      const supportsVision = await resolveModelVision({
        model: modelInstance,
        providerId: parsedModel.providerId,
        modelId: parsedModel.modelId,
        settings: config.effectiveSettings.value,
      })

      const parts: Array<
        | { type: 'text'; text: string }
        | { type: 'file'; mediaType: string; url: string; filename?: string }
      > = [{ type: 'text', text: args.text }]

      for (const file of fileParts) {
        if (!supportsVision) {
          parts.push({
            type: 'text',
            text: `[Attachment: ${file.filename || 'file'} (${file.mediaType || 'unknown'})]`,
          })
          continue
        }

        let url = file.url
        if (url?.startsWith('file://')) {
          try {
            const artifact = await browserReadArtifact(url.replace('file://', ''))
            url = `data:${artifact.mimeType};base64,${artifact.base64}`
          } catch {
            parts.push({
              type: 'text',
              text: `[Attachment unavailable: ${file.filename || url}]`,
            })
            continue
          }
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

      chatStore.appendLocalMessage({
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
    chatStore.startAgentTurn(turnId)

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
        messages: chatStore.messages.value,
        userText: args.text,
        mentions: args.mentions ?? [],
        signal: controller.signal,
        onEvent: handleEvent,
        assistantId: turnId,
        skipUserPersist: args.skipUserPersist,
        standalone: options.standalone,
        permissionLevel: sessionPermissionLevel.value ?? undefined,
        persistPermission,
      })
      status.value = 'ready'
      chatStore.finishAgentTurn()
      await fleetSidebar.refreshSlug(options.projectSlug)
    } catch (err) {
      const aborted = controller.signal.aborted
      const timedOut =
        err instanceof Error &&
        (err.name === 'TimeoutError' || /timeout/i.test(err.message))
      const message = err instanceof Error ? err.message : 'Unknown error'
      error.value = message
      status.value = 'error'
      chatStore.setAgentTurnError({
        kind: timedOut ? 'timeout' : aborted ? 'aborted' : 'error',
        message: timedOut
          ? 'The model took too long to respond.'
          : aborted
            ? 'The run was stopped.'
            : message.includes('No output generated')
              ? 'The model returned an empty response. Check your API key and model ID in Settings.'
              : message,
      })
      chatStore.finishAgentTurn()
      if (!aborted) {
        toast.error('Agent run failed', {
          description: error.value.includes('No output generated')
            ? 'The model returned an empty response. Check your Gateway API key and model ID in Settings.'
            : error.value,
        })
      }
    } finally {
      abortController.value = null
    }
  }

  const submitEditMessage = async (args: {
    newContent: string
    mode: PyrolaChatMode
    model: string
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
      await chatStore.truncateBeforeMessage(
        options.projectSlug,
        options.chatId,
        messageId,
      )
      chatStore.cancelEditMessage()
      await send({
        text,
        mode: args.mode,
        model: args.model,
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
  }): Promise<void> => {
    if (status.value === 'streaming' || status.value === 'submitted') {
      return
    }

    const lastUser = chatStore.getLastUserMessage()
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
      await chatStore.truncateAfterLastUserMessage(
        options.projectSlug,
        options.chatId,
      )
      await send({
        text,
        mode: args.mode,
        model: args.model,
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
  }

  const stop = async (): Promise<void> => {
    abortController.value?.abort()
    abortSubagentsForChat(options.chatId)
    chatStore.setAgentTurnError({
      kind: 'aborted',
      message: 'The run was stopped.',
    })
    status.value = 'ready'
    try {
      await killShellsForChat(options.chatId)
    } catch (error) {
      toast.error('Failed to stop terminals', {
        description: error instanceof Error ? error.message : 'Unknown error',
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

    const meta = chatStore.meta.value
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
        messages: chatStore.messages.value,
        focus,
        frozenSystem: undefined,
        chatModel: meta.model,
      })
      chatStore.appendLocalCompaction(result.summary, focus ?? null)
      chatStore.patchMetaActiveContext({
        checkpointLineId: result.checkpointLineId,
        includeFromCreatedAt: result.includeFromCreatedAt,
        summary: result.summary,
      })
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

    const meta = chatStore.meta.value
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
          messages: chatStore.messages.value,
          chatModel: meta.model,
        })
        summary = compactResult.summary
        chatStore.appendLocalCompaction(compactResult.summary, null)
        chatStore.patchMetaActiveContext({
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
        projectRoot,
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
    setPermissionLevel,
    submitAnswer,
    compactChat,
    createHandoff,
  }
}
