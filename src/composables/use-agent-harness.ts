import { toast } from 'vue-sonner'
import { ref, shallowRef } from 'vue'
import type { ChatStatus } from 'ai'
import type { HarnessEvent } from '@/types/harness/harness-event'
import type { SubagentEntry } from '@/types/harness/subagent-entry'
import type { ContextMention } from '@/types/harness/context-mention'
import type { FileDiff } from '@/types/harness/file-diff'
import type { ToolRun } from '@/types/harness/tool-run'
import type { PyrolaChatMode, PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import useChatStore from '@/composables/use-chat-store'
import useContextUsage from '@/composables/use-context-usage'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import runOrchestrator, {
  mapMetaStatusToChatStatus,
  resumeOrchestrator,
} from '@/services/harness/orchestrator'
import { resolveApproval } from '@/services/harness/approval-gate'
import { refreshFleetSidebar } from '@/composables/use-fleet-sidebar'
import parseModelRef from '@/utils/parse-model-ref'
import listConfiguredProviders from '@/services/providers/list-configured-providers'
import {
  abort as abortSubagentsForChat,
  getSubagent,
} from '@/services/harness/subagent-registry'

export type AgentHarnessOptions = {
  projectSlug: string
  chatId: string
  projectRoot: string
  projectName: string
}

export type { ToolRun } from '@/types/harness/tool-run'
export type { SubagentEntry } from '@/types/harness/subagent-entry'

export default (options: AgentHarnessOptions) => {
  const chatStore = useChatStore()
  const config = usePyrolaConfig()
  const contextUsage = useContextUsage()

  const status = ref<ChatStatus>('ready')
  const error = ref<string | null>(null)
  const pendingApprovals = shallowRef<
    Array<{ toolCallId: string; name: string; diff: FileDiff[] }>
  >([])
  const toolRuns = shallowRef<ToolRun[]>([])
  const subagents = shallowRef<SubagentEntry[]>([])
  const abortController = ref<AbortController | null>(null)
  const liveEvents = ref<HarnessEvent[]>([])
  const lastRunConfig = ref<{
    mode: PyrolaChatMode
    model: string
    mentions: ContextMention[]
    effectiveSettings: PyrolaSettings
  } | null>(null)
  const resumingSubagents = new Set<string>()

  const handleEvent = (event: HarnessEvent): void => {
    liveEvents.value = [...liveEvents.value, event]
    if (event.type === 'text-delta') {
      chatStore.appendLocalTextDelta(event.delta, event.messageId, event.stepId)
      status.value = 'streaming'
    }
    if (event.type === 'reasoning-delta') {
      chatStore.appendLocalReasoningDelta(event.delta, event.messageId)
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
        name: event.name,
        blocking: event.blocking,
      })
    }
    if (event.type === 'subagent-event') {
      const running = [...subagents.value].reverse().find((item) => item.status === 'running')
      if (running) {
        subagents.value = subagents.value.map((item) =>
          item.subagentId === running.subagentId
            ? { ...item, events: [...item.events, event.event] }
            : item,
        )
      }
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
        void resumeAfterSubagent(event.subagentId, event.summary).finally(() => {
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
      pendingApprovals.value = [
        ...pendingApprovals.value,
        {
          toolCallId: event.toolCallId,
          name: event.name,
          diff: event.diff,
        },
      ]
    }
    if (event.type === 'context-budget') {
      contextUsage.setBudget({
        modelId: event.modelId,
        used: event.used,
        limit: event.limit,
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
      refreshFleetSidebar().catch((error) => {
        toast.error('Failed to refresh sidebar', {
          description: error instanceof Error ? error.message : 'Unknown error',
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
    const config = lastRunConfig.value
    if (!record || !config) {
      return
    }

    if (!config.model) {
      toast.error('Select a model before resuming')
      return
    }

    const parsedModel = parseModelRef(config.model)
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
        mode: config.mode,
        modelId: parsedModel.modelId,
        providerId: parsedModel.providerId,
        settings: config.effectiveSettings,
        messages: chatStore.messages.value,
        mentions: config.mentions,
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
      })
      status.value = 'ready'
      chatStore.finishAgentTurn()
      await refreshFleetSidebar()
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
      chatStore.appendLocalMessage({
        id: crypto.randomUUID(),
        role: 'user',
        parts: [{ type: 'text', text: args.text }],
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
      })
      status.value = 'ready'
      chatStore.finishAgentTurn()
      await refreshFleetSidebar()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      status.value = 'error'
      chatStore.finishAgentTurn()
      const description =
        error.value.includes('No output generated')
          ? 'The model returned an empty response. Check your Gateway API key and model ID in Settings.'
          : error.value
      toast.error('Agent run failed', {
        description,
      })
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
    } catch (error) {
      toast.error('Failed to edit message', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const resetToLastQuestion = async (args: {
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
    } catch (error) {
      toast.error('Failed to reset conversation', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const stop = (): void => {
    abortController.value?.abort()
    abortSubagentsForChat(options.chatId)
    status.value = 'ready'
  }

  const approve = (toolCallId: string): void => {
    resolveApproval(toolCallId, true)
    pendingApprovals.value = pendingApprovals.value.filter(
      (item) => item.toolCallId !== toolCallId,
    )
  }

  const reject = (toolCallId: string): void => {
    resolveApproval(toolCallId, false)
    pendingApprovals.value = pendingApprovals.value.filter(
      (item) => item.toolCallId !== toolCallId,
    )
  }

  return {
    status,
    error,
    pendingApprovals,
    toolRuns,
    subagents,
    liveEvents,
    send,
    submitEditMessage,
    resetToLastQuestion,
    stop,
    approve,
    reject,
    submitAnswer,
  }
}
