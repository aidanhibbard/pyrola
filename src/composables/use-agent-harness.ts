import { toast } from 'vue-sonner'
import { computed, ref, shallowRef } from 'vue'
import type { ChatStatus } from 'ai'
import type { HarnessEvent } from '@/types/harness/harness-event'
import type { ContextMention } from '@/types/harness/context-mention'
import type { FileDiff } from '@/types/harness/file-diff'
import type { ToolRun } from '@/types/harness/tool-run'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import useChatStore from '@/composables/use-chat-store'
import useContextUsage from '@/composables/use-context-usage'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import runOrchestrator, { mapMetaStatusToChatStatus } from '@/services/harness/orchestrator'
import { resolveApproval } from '@/services/harness/approval-gate'
import { refreshFleetSidebar } from '@/composables/use-fleet-sidebar'

export type AgentHarnessOptions = {
  projectSlug: string
  chatId: string
  projectRoot: string
  projectName: string
}

export type { ToolRun } from '@/types/harness/tool-run'

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
  const abortController = ref<AbortController | null>(null)
  const liveEvents = ref<HarnessEvent[]>([])

  const providerId = computed(
    () => config.effectiveSettings.value['agent.defaultProvider'] ?? '',
  )

  const handleEvent = (event: HarnessEvent): void => {
    liveEvents.value = [...liveEvents.value, event]
    if (event.type === 'text-delta') {
      chatStore.appendLocalTextDelta(event.delta, event.messageId)
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
      }
      toolRuns.value = toolRuns.value.map((item) =>
        item.toolCallId === event.toolCallId ? run : item,
      )
      chatStore.upsertLocalToolRun(run)
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
      refreshFleetSidebar().catch((error) => {
        toast.error('Failed to refresh sidebar', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    }
    if (event.type === 'turn-aborted') {
      status.value = 'ready'
    }
  }

  const send = async (args: {
    text: string
    mode: PyrolaChatMode
    model: string
    mentions?: ContextMention[]
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

    if (!providerId.value) {
      toast.error('No provider configured', {
        description: 'Set a default provider in Settings.',
      })
      return
    }

    error.value = null
    status.value = 'submitted'
    toolRuns.value = []

    chatStore.appendLocalMessage({
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: args.text }],
    })

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
        modelId: args.model,
        providerId: providerId.value,
        settings: config.effectiveSettings.value,
        messages: chatStore.messages.value,
        userText: args.text,
        mentions: args.mentions ?? [],
        signal: controller.signal,
        onEvent: handleEvent,
        assistantId: turnId,
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

  const stop = (): void => {
    abortController.value?.abort()
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
    liveEvents,
    send,
    stop,
    approve,
    reject,
  }
}
