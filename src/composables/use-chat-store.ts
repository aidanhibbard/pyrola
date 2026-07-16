import { computed, ref } from 'vue'
import type { UIMessage } from 'ai'
import type { AgentStep } from '@/types/chat/agent-step'
import type { AgentTurn } from '@/types/chat/agent-turn'
import type { ChatMeta } from '@/types/chat/chat-meta'
import type { ChatTimelineItem } from '@/types/chat/chat-timeline-item'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import type { ToolRun } from '@/types/harness/tool-run'
import { chatMetaSchema } from '@/schemas/chat-meta'
import { chatMessageLineSchema } from '@/schemas/chat-message-line'
import {
  createChat,
  listChats,
  readChatMeta,
  readChatMessages,
} from '@/services/pyrola/pyrola-tauri'

type MessagePart = UIMessage['parts'][number]

const meta = ref<ChatMeta | null>(null)
const messages = ref<UIMessage[]>([])
const timeline = ref<ChatTimelineItem[]>([])
const loading = ref(false)
const activeTurnId = ref<string | null>(null)
const activeStepId = ref<string | null>(null)

const mapMeta = (record: {
  id: string
  title: string
  projectSlug: string
  projectRoot: string
  mode: string
  model: string
  status: string
  createdAt: string
  updatedAt: string
  forkedFrom: string | null
  pinned: boolean
  pinnedAt: string | null
}): ChatMeta =>
  chatMetaSchema.parse({
    id: record.id,
    title: record.title,
    projectSlug: record.projectSlug,
    projectRoot: record.projectRoot,
    mode: record.mode,
    model: record.model,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    forkedFrom: record.forkedFrom,
    pinned: record.pinned,
    pinnedAt: record.pinnedAt,
  })

const parsePart = (part: Record<string, unknown>): MessagePart => {
  if (part.type === 'reasoning' && typeof part.text === 'string') {
    return { type: 'reasoning', text: part.text }
  }
  if (typeof part.text === 'string') {
    return { type: 'text', text: part.text }
  }
  return { type: 'text', text: '' }
}

const extractReasoning = (parts: MessagePart[]): string =>
  parts
    .filter((part) => part.type === 'reasoning')
    .map((part) => (part.type === 'reasoning' ? part.text : ''))
    .join('')

const extractText = (parts: MessagePart[]): string =>
  parts
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')

const createStep = (id: string): AgentStep => ({
  id,
  reasoning: '',
  tools: [],
})

const upsertToolInStep = (step: AgentStep, run: ToolRun): AgentStep => {
  const tools = [...step.tools]
  const index = tools.findIndex((item) => item.toolCallId === run.toolCallId)
  if (index >= 0) {
    const existing = tools[index]!
    const status =
      (existing.status === 'done' || existing.status === 'error') &&
      run.status === 'running'
        ? existing.status
        : run.status
    tools[index] = {
      ...existing,
      ...run,
      status,
      args: run.args ?? existing.args,
      result: run.result ?? existing.result,
    }
  } else {
    tools.push(run)
  }
  return { ...step, tools }
}

const closeRunningTools = (step: AgentStep): AgentStep => ({
  ...step,
  tools: step.tools.map((tool) =>
    tool.status === 'running'
      ? {
          ...tool,
          status: 'error' as const,
          result: tool.result ?? { error: 'Tool did not complete' },
        }
      : tool,
  ),
})

const updateTimelineTurn = (turn: AgentTurn): void => {
  const items = [...timeline.value]
  const index = items.findIndex(
    (item) => item.type === 'agent-turn' && item.turn.id === turn.id,
  )
  if (index >= 0) {
    items[index] = { type: 'agent-turn', turn }
    timeline.value = items
    return
  }
  timeline.value = [...items, { type: 'agent-turn', turn }]
}

const updateAssistantMessage = (turn: AgentTurn): void => {
  const reasoning = turn.steps.map((step) => step.reasoning).join('')
  if (!reasoning && !turn.text) {
    return
  }
  const parts: MessagePart[] = []
  if (reasoning) {
    parts.push({ type: 'reasoning', text: reasoning })
  }
  parts.push({ type: 'text', text: turn.text })

  const index = messages.value.findIndex((message) => message.id === turn.id)
  const message: UIMessage = {
    id: turn.id,
    role: 'assistant',
    parts,
  }
  if (index >= 0) {
    messages.value = messages.value.map((item, itemIndex) =>
      itemIndex === index ? message : item,
    )
    return
  }
  messages.value = [...messages.value, message]
}

const getStepIndex = (turn: AgentTurn, stepId: string): number =>
  turn.steps.findIndex((step) => step.id === stepId)

const ensureStep = (turn: AgentTurn, stepId: string): AgentTurn => {
  if (getStepIndex(turn, stepId) >= 0) {
    return turn
  }
  return { ...turn, steps: [...turn.steps, createStep(stepId)] }
}

const patchStep = (
  turn: AgentTurn,
  stepId: string,
  patch: Partial<AgentStep>,
): AgentTurn => {
  const next = ensureStep(turn, stepId)
  const index = getStepIndex(next, stepId)
  if (index < 0) {
    return next
  }
  const steps = [...next.steps]
  steps[index] = { ...steps[index]!, ...patch }
  return { ...next, steps }
}

export default () => {
  const chatId = computed(() => meta.value?.id ?? null)

  const loadChat = async (projectSlug: string, chatId: string): Promise<void> => {
    loading.value = true
    try {
      const metaRecord = await readChatMeta(projectSlug, chatId)
      meta.value = mapMeta(metaRecord)
      const lines = await readChatMessages(projectSlug, chatId)
      const nextMessages: UIMessage[] = []
      const nextTimeline: ChatTimelineItem[] = []
      let pendingTurn: AgentTurn | null = null
      let currentStepId: string | null = null

      const flushTurn = (): void => {
        if (!pendingTurn) {
          return
        }
        if (currentStepId) {
          const index = getStepIndex(pendingTurn, currentStepId)
          if (index >= 0) {
            const steps: AgentStep[] = [...pendingTurn.steps]
            steps[index] = closeRunningTools(steps[index]!)
            pendingTurn = { ...pendingTurn, steps }
          }
        }
        const hasContent =
          pendingTurn.text.length > 0 ||
          pendingTurn.steps.some(
            (step) => step.reasoning.length > 0 || step.tools.length > 0,
          )
        if (hasContent) {
          const reasoning = pendingTurn.steps
            .map((step) => step.reasoning)
            .join('')
          nextTimeline.push({ type: 'agent-turn', turn: pendingTurn })
          nextMessages.push({
            id: pendingTurn.id,
            role: 'assistant',
            parts: [
              ...(reasoning
                ? [{ type: 'reasoning' as const, text: reasoning }]
                : []),
              { type: 'text' as const, text: pendingTurn.text },
            ],
          })
        }
        pendingTurn = null
        currentStepId = null
      }

      for (const line of lines) {
        const parsed = chatMessageLineSchema.parse(line)
        const harnessEvent = parsed.harnessEvent

        if (harnessEvent?.type === 'step-boundary') {
          const stepId = String(harnessEvent.stepId ?? '')
          const action = String(harnessEvent.action ?? '')
          if (!stepId || !pendingTurn) {
            continue
          }
          if (action === 'start') {
            currentStepId = stepId
            pendingTurn = ensureStep(pendingTurn, stepId)
          }
          if (action === 'finish' && currentStepId === stepId) {
            const index = getStepIndex(pendingTurn, stepId)
            if (index >= 0) {
              const steps: AgentStep[] = [...pendingTurn.steps]
              steps[index] = closeRunningTools(steps[index]!)
              pendingTurn = { ...pendingTurn, steps }
            }
          }
          continue
        }

        if (harnessEvent && harnessEvent.type === 'tool-run') {
          const persistedStatus = harnessEvent.status as ToolRun['status'] | undefined
          const run: ToolRun = {
            toolCallId: String(harnessEvent.toolCallId ?? ''),
            name: String(harnessEvent.name ?? 'tool'),
            status:
              persistedStatus === 'running'
                ? 'error'
                : (persistedStatus ?? 'done'),
            args: harnessEvent.args,
            result:
              harnessEvent.result ??
              (persistedStatus === 'running'
                ? { error: 'Tool did not complete' }
                : undefined),
          }
          if (!run.toolCallId) {
            continue
          }
          if (!pendingTurn) {
            pendingTurn = {
              id: run.toolCallId,
              steps: [],
              text: '',
            }
          }
          if (!currentStepId) {
            currentStepId = 'legacy-step'
            pendingTurn = ensureStep(pendingTurn, currentStepId)
          }
          const stepId =
            typeof harnessEvent.stepId === 'string' && harnessEvent.stepId.length > 0
              ? harnessEvent.stepId
              : currentStepId
          const existingStep =
            pendingTurn.steps.find((step) => step.id === stepId) ??
            createStep(stepId)
          pendingTurn = patchStep(
            pendingTurn,
            stepId,
            upsertToolInStep(existingStep, run),
          )
          continue
        }

        if (parsed.role === 'user') {
          flushTurn()
          const message: UIMessage = {
            id: parsed.id,
            role: 'user',
            parts: parsed.parts.map(parsePart),
          }
          nextMessages.push(message)
          nextTimeline.push({ type: 'user', message })
          continue
        }

        if (parsed.role === 'assistant') {
          const parts = parsed.parts.map(parsePart)
          const reasoning = extractReasoning(parts)
          const text = extractText(parts)
          if (!pendingTurn) {
            pendingTurn = {
              id: parsed.id,
              steps: reasoning
                ? [{ id: parsed.id, reasoning, tools: [] }]
                : [],
              text,
            }
          } else {
            if (reasoning) {
              const stepId = currentStepId ?? parsed.id
              pendingTurn = patchStep(pendingTurn, stepId, {
                reasoning:
                  (pendingTurn.steps.find((step) => step.id === stepId)?.reasoning ??
                    '') + reasoning,
              })
            }
            pendingTurn = {
              ...pendingTurn,
              id: parsed.id,
              text: text || pendingTurn.text,
            }
          }
          flushTurn()
        }
      }

      flushTurn()
      messages.value = nextMessages
      timeline.value = nextTimeline
      activeTurnId.value = null
      activeStepId.value = null
    } finally {
      loading.value = false
    }
  }

  const createNewChat = async (args: {
    projectSlug: string
    projectRoot: string
    mode: PyrolaChatMode
    model: string
    title?: string
  }): Promise<ChatMeta> => {
    const record = await createChat(args)
    meta.value = mapMeta(record)
    messages.value = []
    timeline.value = []
    activeTurnId.value = null
    activeStepId.value = null
    return meta.value
  }

  const listProjectChats = async (projectSlug: string): Promise<ChatMeta[]> => {
    const records = await listChats(projectSlug)
    return records.map(mapMeta)
  }

  const appendLocalMessage = (message: UIMessage): void => {
    messages.value = [...messages.value, message]
    if (message.role === 'user') {
      timeline.value = [...timeline.value, { type: 'user', message }]
    }
  }

  const startAgentTurn = (turnId: string): void => {
    activeTurnId.value = turnId
    activeStepId.value = null
    const turn: AgentTurn = {
      id: turnId,
      steps: [],
      text: '',
    }
    timeline.value = [...timeline.value, { type: 'agent-turn', turn }]
  }

  const getActiveTurn = (): AgentTurn | null => {
    if (!activeTurnId.value) {
      return null
    }
    const item = timeline.value.find(
      (entry) =>
        entry.type === 'agent-turn' && entry.turn.id === activeTurnId.value,
    )
    return item?.type === 'agent-turn' ? item.turn : null
  }

  const patchActiveTurn = (turn: AgentTurn): void => {
    updateTimelineTurn(turn)
    updateAssistantMessage(turn)
  }

  const startAgentStep = (stepId: string): void => {
    const current = getActiveTurn()
    if (!current) {
      return
    }
    if (activeStepId.value && activeStepId.value !== stepId) {
      const index = getStepIndex(current, activeStepId.value)
      if (index >= 0) {
        const steps = [...current.steps]
        steps[index] = closeRunningTools(steps[index]!)
        patchActiveTurn({ ...current, steps })
      }
    }
    activeStepId.value = stepId
    patchActiveTurn(ensureStep(getActiveTurn() ?? current, stepId))
  }

  const finishAgentStep = (): void => {
    const current = getActiveTurn()
    if (!current || !activeStepId.value) {
      return
    }
    const index = getStepIndex(current, activeStepId.value)
    if (index >= 0) {
      const steps = [...current.steps]
      steps[index] = closeRunningTools(steps[index]!)
      patchActiveTurn({ ...current, steps })
    }
    activeStepId.value = null
  }

  const ensureActiveStep = (): string => {
    if (activeStepId.value) {
      return activeStepId.value
    }
    const stepId = crypto.randomUUID()
    startAgentStep(stepId)
    return stepId
  }

  const appendLocalTextDelta = (delta: string, messageId?: string): void => {
    const turnId = messageId ?? activeTurnId.value
    if (!turnId) {
      return
    }
    if (turnId !== activeTurnId.value) {
      activeTurnId.value = turnId
    }
    const current =
      getActiveTurn() ??
      ({
        id: turnId,
        steps: [],
        text: '',
      } satisfies AgentTurn)
    patchActiveTurn({ ...current, id: turnId, text: current.text + delta })
  }

  const appendLocalReasoningDelta = (delta: string, messageId?: string): void => {
    const turnId = messageId ?? activeTurnId.value
    if (!turnId) {
      return
    }
    if (turnId !== activeTurnId.value) {
      activeTurnId.value = turnId
    }
    const stepId = ensureActiveStep()
    const current =
      getActiveTurn() ??
      ({
        id: turnId,
        steps: [],
        text: '',
      } satisfies AgentTurn)
    const step =
      current.steps.find((item) => item.id === stepId) ?? createStep(stepId)
    patchActiveTurn(
      patchStep(current, stepId, {
        reasoning: step.reasoning + delta,
      }),
    )
  }

  const upsertLocalToolRun = (run: ToolRun): void => {
    const current = getActiveTurn()
    if (!current) {
      return
    }
    const stepId = ensureActiveStep()
    const step =
      current.steps.find((item) => item.id === stepId) ?? createStep(stepId)
    patchActiveTurn(patchStep(current, stepId, upsertToolInStep(step, run)))
  }

  const finishAgentTurn = (): void => {
    finishAgentStep()
    const current = getActiveTurn()
    if (current) {
      patchActiveTurn({
        ...current,
        steps: current.steps.map((step) => closeRunningTools(step)),
      })
    }
    activeTurnId.value = null
    activeStepId.value = null
  }

  return {
    meta,
    messages,
    timeline,
    loading,
    chatId,
    loadChat,
    createNewChat,
    listProjectChats,
    appendLocalMessage,
    startAgentTurn,
    startAgentStep,
    finishAgentStep,
    appendLocalTextDelta,
    appendLocalReasoningDelta,
    upsertLocalToolRun,
    finishAgentTurn,
  }
}
