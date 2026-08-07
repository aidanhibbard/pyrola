import { computed, ref } from 'vue'
import type { UIMessage } from 'ai'
import type { AgentStep } from '@/types/chat/agent-step'
import type { AgentTurn } from '@/types/chat/agent-turn'
import type { AgentTurnError } from '@/types/chat/agent-turn-error'
import type { ChatMeta } from '@/types/chat/chat-meta'
import type { ChatTimelineItem, SubagentTimelineItem } from '@/types/chat/chat-timeline-item'
import type { ChatArtifact } from '@/types/chat/chat-artifact'
import type { PendingQuestionState } from '@/types/chat/pending-question'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import type { ToolRun } from '@/types/harness/tool-run'
import type { TodoItem, HarnessEvent } from '@/types/harness/harness-event'
import type { FileDiff } from '@/types/harness/file-diff'
import { resolveQuestion } from '@/services/harness/question-gate'
import { chatMetaSchema } from '@/schemas/chat-meta'
import { chatMessageLineSchema } from '@/schemas/chat-message-line'
import { fileDiffListSchema } from '@/schemas/file-diff'
import applySubagentToolEvent from '@/utils/apply-subagent-tool-event'
import {
  createChat,
  listChats,
  readChatMeta,
  readChatMessages,
} from '@/services/pyrola/pyrola-tauri'
import {
  truncateChatLogAfterLastUser,
  truncateChatLogBeforeMessage,
} from '@/services/chat/truncate-chat-log'

type MessagePart = UIMessage['parts'][number]

const meta = ref<ChatMeta | null>(null)
const messages = ref<UIMessage[]>([])
const timeline = ref<ChatTimelineItem[]>([])
const loading = ref(false)
const activeTurnId = ref<string | null>(null)
const activeStepId = ref<string | null>(null)
const pendingStepText = ref('')
const pendingQuestion = ref<PendingQuestionState | null>(null)
const editingMessageId = ref<string | null>(null)
const editDraftText = ref('')

const parseChatArtifact = (value: unknown): ChatArtifact | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  const record = value as Record<string, unknown>
  const kind = record.kind
  const path = record.path
  if (
    (kind !== 'plan' && kind !== 'studio' && kind !== 'file') ||
    typeof path !== 'string' ||
    path.length === 0
  ) {
    return undefined
  }
  const label = typeof record.label === 'string' ? record.label : undefined
  return { kind, path, label }
}

const parseChatDiffs = (value: unknown): FileDiff[] | undefined => {
  const parsed = fileDiffListSchema.safeParse(value)
  if (!parsed.success) {
    return undefined
  }
  return parsed.data
}

const parseTodoItems = (value: unknown): TodoItem[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }
    const record = item as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id : ''
    const content = typeof record.content === 'string' ? record.content : ''
    const status = record.status
    if (
      !id ||
      !content ||
      (status !== 'pending' &&
        status !== 'in_progress' &&
        status !== 'completed' &&
        status !== 'cancelled')
    ) {
      return []
    }
    return [{ id, content, status }]
  })
}

const upsertTodoTimelineItem = (items: ChatTimelineItem[], todos: TodoItem[]): ChatTimelineItem[] => {
  if (todos.length === 0) {
    return items
  }
  const next = [...items]
  const last = next.at(-1)
  if (last?.type === 'todo') {
    next[next.length - 1] = { type: 'todo', todos }
    return next
  }
  return [...next, { type: 'todo', todos }]
}

const upsertSubagentStart = (
  items: ChatTimelineItem[],
  subagent: Omit<SubagentTimelineItem, 'type' | 'status' | 'tools'> & {
    tools?: SubagentTimelineItem['tools']
  },
): ChatTimelineItem[] => {
  const index = items.findIndex(
    (item) => item.type === 'subagent' && item.subagentId === subagent.subagentId,
  )
  if (index >= 0) {
    const next = [...items]
    const existing = next[index]
    if (existing?.type === 'subagent') {
      next[index] = {
        ...existing,
        toolCallId: subagent.toolCallId ?? existing.toolCallId,
        name: subagent.name,
        blocking: subagent.blocking,
        prompt: subagent.prompt ?? existing.prompt,
        model: subagent.model ?? existing.model,
        tools: subagent.tools ?? existing.tools,
      }
    }
    return next
  }
  return [
    ...items,
    {
      type: 'subagent',
      subagentId: subagent.subagentId,
      toolCallId: subagent.toolCallId,
      name: subagent.name,
      blocking: subagent.blocking,
      prompt: subagent.prompt,
      model: subagent.model,
      status: 'running',
      tools: subagent.tools ?? [],
    },
  ]
}

const completeSubagentTimelineItem = (
  items: ChatTimelineItem[],
  subagentId: string,
  summary: string,
): ChatTimelineItem[] => {
  const index = items.findIndex(
    (item) => item.type === 'subagent' && item.subagentId === subagentId,
  )
  if (index >= 0) {
    const next = [...items]
    const existing = next[index]
    if (existing?.type === 'subagent') {
      next[index] = {
        ...existing,
        status: 'done',
        summary,
      }
    }
    return next
  }
  return [
    ...items,
    {
      type: 'subagent',
      subagentId,
      name: 'Sub-agent',
      blocking: false,
      status: 'done',
      summary,
      tools: [],
    },
  ]
}

const appendSubagentToolEvent = (
  items: ChatTimelineItem[],
  subagentId: string,
  event: HarnessEvent,
): ChatTimelineItem[] => {
  const index = items.findIndex(
    (item) => item.type === 'subagent' && item.subagentId === subagentId,
  )
  if (index < 0) {
    return items
  }
  const existing = items[index]
  if (existing?.type !== 'subagent') {
    return items
  }
  const next = [...items]
  next[index] = {
    ...existing,
    tools: applySubagentToolEvent(existing.tools, event),
  }
  return next
}

const setSubagentPrompt = (
  items: ChatTimelineItem[],
  subagentId: string,
  prompt: string,
): ChatTimelineItem[] => {
  const index = items.findIndex(
    (item) => item.type === 'subagent' && item.subagentId === subagentId,
  )
  if (index < 0) {
    return items
  }
  const existing = items[index]
  if (existing?.type !== 'subagent') {
    return items
  }
  const next = [...items]
  next[index] = {
    ...existing,
    prompt,
  }
  return next
}

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
  prefixSnapshot?: ChatMeta['prefixSnapshot']
  activeContext?: ChatMeta['activeContext']
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
    prefixSnapshot: record.prefixSnapshot,
    activeContext: record.activeContext,
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

const createStep = (id: string, text = ''): AgentStep => ({
  id,
  text,
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
      artifact: run.artifact ?? existing.artifact,
      diffs: run.diffs ?? existing.diffs,
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
  const text =
    turn.text.trim() ||
    turn.steps
      .map((step) => step.text.trim())
      .filter((value) => value.length > 0)
      .join('\n\n')
  if (!reasoning && !text) {
    return
  }
  const parts: MessagePart[] = []
  if (reasoning) {
    parts.push({ type: 'reasoning', text: reasoning })
  }
  parts.push({ type: 'text', text })

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

const distributeLegacyStepText = (turn: AgentTurn): AgentTurn => {
  const paragraphs = turn.text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  if (paragraphs.length === 0 || turn.steps.some((step) => step.text.trim().length > 0)) {
    return turn
  }

  const toolStepIndexes = turn.steps
    .map((step, index) => (step.tools.length > 0 ? index : -1))
    .filter((index) => index >= 0)
  const assignCount = Math.min(paragraphs.length, toolStepIndexes.length)
  if (assignCount === 0) {
    return turn
  }

  const startAt = toolStepIndexes.length - assignCount
  const steps = [...turn.steps]
  for (let index = 0; index < assignCount; index += 1) {
    const stepIndex = toolStepIndexes[startAt + index]!
    steps[stepIndex] = {
      ...steps[stepIndex]!,
      text: paragraphs[index]!,
    }
  }

  return {
    ...turn,
    steps,
    text: paragraphs.slice(assignCount).join('\n\n'),
  }
}

const rebuildMessagesFromTimeline = (items: ChatTimelineItem[]): UIMessage[] => {
  const nextMessages: UIMessage[] = []
  for (const item of items) {
    if (item.type === 'user') {
      nextMessages.push(item.message)
      continue
    }
    if (item.type !== 'agent-turn') {
      continue
    }
    const turn = item.turn
    const reasoning = turn.steps.map((step) => step.reasoning).join('')
    const text =
      turn.text.trim() ||
      turn.steps
        .map((step) => step.text.trim())
        .filter((value) => value.length > 0)
        .join('\n\n')
    nextMessages.push({
      id: turn.id,
      role: 'assistant',
      parts: [
        ...(reasoning ? [{ type: 'reasoning' as const, text: reasoning }] : []),
        { type: 'text' as const, text },
      ],
    })
  }
  return nextMessages
}

const clearActiveTurnState = (): void => {
  activeTurnId.value = null
  activeStepId.value = null
  pendingStepText.value = ''
  pendingQuestion.value = null
}

const extractUserMessageText = (message: UIMessage): string =>
  message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')

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
      let pendingSubagents: ChatTimelineItem[] = []

      const flushTurn = (): void => {
        if (!pendingTurn) {
          if (pendingSubagents.length > 0) {
            nextTimeline.push(...pendingSubagents)
            pendingSubagents = []
          }
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
            (step) =>
              step.text.length > 0 ||
              step.reasoning.length > 0 ||
              step.tools.length > 0,
          )
        if (hasContent) {
          const normalizedTurn = distributeLegacyStepText(pendingTurn)
          const reasoning = normalizedTurn.steps
            .map((step) => step.reasoning)
            .join('')
          nextTimeline.push({ type: 'agent-turn', turn: normalizedTurn })
          nextMessages.push({
            id: normalizedTurn.id,
            role: 'assistant',
            parts: [
              ...(reasoning
                ? [{ type: 'reasoning' as const, text: reasoning }]
                : []),
              { type: 'text' as const, text: normalizedTurn.text },
            ],
          })
        }
        if (pendingSubagents.length > 0) {
          nextTimeline.push(...pendingSubagents)
          pendingSubagents = []
        }
        pendingTurn = null
        currentStepId = null
      }

      for (const line of lines) {
        const parsed = chatMessageLineSchema.parse(line)
        const harnessEvent = parsed.harnessEvent

        if (harnessEvent?.type === 'todo-update') {
          const todos = parseTodoItems(harnessEvent.todos)
          if (todos.length > 0) {
            const merged = upsertTodoTimelineItem(nextTimeline, todos)
            nextTimeline.length = 0
            nextTimeline.push(...merged)
          }
          continue
        }

        if (harnessEvent?.type === 'subagent-start') {
          const subagentId = String(harnessEvent.subagentId ?? '')
          const toolCallId =
            typeof harnessEvent.toolCallId === 'string' &&
            harnessEvent.toolCallId.length > 0
              ? harnessEvent.toolCallId
              : undefined
          const name = String(harnessEvent.name ?? 'Sub-agent')
          const blocking = Boolean(harnessEvent.blocking)
          const prompt =
            typeof harnessEvent.prompt === 'string' && harnessEvent.prompt.length > 0
              ? harnessEvent.prompt
              : undefined
          const model =
            typeof harnessEvent.model === 'string' && harnessEvent.model.length > 0
              ? harnessEvent.model
              : undefined
          if (subagentId) {
            const target = pendingTurn ? pendingSubagents : nextTimeline
            const merged = upsertSubagentStart(target, {
              subagentId,
              toolCallId,
              name,
              blocking,
              prompt,
              model,
            })
            if (pendingTurn) {
              pendingSubagents = merged
            } else {
              nextTimeline.length = 0
              nextTimeline.push(...merged)
            }
          }
          continue
        }

        if (harnessEvent?.type === 'subagent-result') {
          const subagentId = String(harnessEvent.subagentId ?? '')
          const summary = String(harnessEvent.summary ?? '')
          if (subagentId) {
            const inPending = pendingSubagents.some(
              (item) => item.type === 'subagent' && item.subagentId === subagentId,
            )
            if (inPending) {
              pendingSubagents = completeSubagentTimelineItem(
                pendingSubagents,
                subagentId,
                summary,
              )
            } else {
              const merged = completeSubagentTimelineItem(
                nextTimeline,
                subagentId,
                summary,
              )
              nextTimeline.length = 0
              nextTimeline.push(...merged)
            }
          }
          continue
        }

        if (harnessEvent?.type === 'subagent-event') {
          const subagentId = String(harnessEvent.subagentId ?? '')
          const nested = harnessEvent.event
          if (
            subagentId &&
            nested &&
            typeof nested === 'object' &&
            'type' in (nested as Record<string, unknown>)
          ) {
            const nestedEvent = nested as HarnessEvent
            const inPending = pendingSubagents.some(
              (item) => item.type === 'subagent' && item.subagentId === subagentId,
            )
            if (inPending) {
              pendingSubagents = appendSubagentToolEvent(
                pendingSubagents,
                subagentId,
                nestedEvent,
              )
            } else {
              const merged = appendSubagentToolEvent(
                nextTimeline,
                subagentId,
                nestedEvent,
              )
              nextTimeline.length = 0
              nextTimeline.push(...merged)
            }
          }
          continue
        }

        if (harnessEvent?.type === 'pending-subagent') {
          const subagentId = String(harnessEvent.subagentId ?? '')
          const prompt = String(harnessEvent.prompt ?? '')
          if (subagentId && prompt) {
            const inPending = pendingSubagents.some(
              (item) => item.type === 'subagent' && item.subagentId === subagentId,
            )
            if (inPending) {
              pendingSubagents = setSubagentPrompt(pendingSubagents, subagentId, prompt)
            } else {
              const merged = setSubagentPrompt(nextTimeline, subagentId, prompt)
              nextTimeline.length = 0
              nextTimeline.push(...merged)
            }
          }
          continue
        }

        if (harnessEvent?.type === 'compaction') {
          flushTurn()
          const summary = typeof harnessEvent.summary === 'string' ? harnessEvent.summary : ''
          const focus = typeof harnessEvent.focus === 'string' ? harnessEvent.focus : null
          if (summary) {
            nextTimeline.push({ type: 'compaction', summary, focus })
          }
          continue
        }

        if (harnessEvent?.type === 'step-text') {
          const stepId = String(harnessEvent.stepId ?? '')
          const text = String(harnessEvent.text ?? '')
          if (!stepId || !text || !pendingTurn) {
            continue
          }
          pendingTurn = patchStep(pendingTurn, stepId, {
            text:
              (pendingTurn.steps.find((step) => step.id === stepId)?.text ?? '') +
              text,
          })
          continue
        }

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
            artifact: parseChatArtifact(harnessEvent.artifact),
            diffs: parseChatDiffs(harnessEvent.diffs),
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
            metadata: {
              createdAt: parsed.createdAt,
              ...(typeof parsed.model === 'string' && parsed.model.length > 0
                ? { model: parsed.model }
                : {}),
            },
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
                ? [{ id: parsed.id, text: '', reasoning, tools: [] }]
                : [],
              text,
            }
          } else {
            let nextTurn: AgentTurn = pendingTurn
            if (reasoning) {
              // Aggregate assistant reasoning is not persisted per-step. Attach it
              // to the earliest step so it renders before tools (e.g. spawn_subagent).
              const stepId = nextTurn.steps[0]?.id ?? currentStepId ?? parsed.id
              nextTurn = patchStep(nextTurn, stepId, {
                reasoning:
                  (nextTurn.steps.find((step: AgentStep) => step.id === stepId)
                    ?.reasoning ?? '') + reasoning,
              })
            }
            const fromSteps: string = nextTurn.steps
              .map((step: AgentStep) => step.text.trim())
              .filter((value: string) => value.length > 0)
              .join('\n\n')
            // Prefer chronological step text. Only keep assistant-line text on the
            // turn when it is not already restored via step-text events.
            const duplicated =
              Boolean(text) &&
              Boolean(fromSteps) &&
              (text === fromSteps || text.includes(fromSteps) || fromSteps.includes(text))
            pendingTurn = {
              ...nextTurn,
              id: parsed.id,
              text: duplicated ? '' : text || nextTurn.text,
              steps: nextTurn.steps,
            }
          }
          flushTurn()
        }
      }

      flushTurn()

      const promptByToolCallId = new Map<string, string>()
      const promptBySubagentId = new Map<string, string>()
      for (const item of nextTimeline) {
        if (item.type !== 'agent-turn') {
          continue
        }
        for (const step of item.turn.steps) {
          for (const tool of step.tools) {
            if (tool.name !== 'spawn_subagent' || !tool.args || typeof tool.args !== 'object') {
              continue
            }
            const args = tool.args as Record<string, unknown>
            const prompt = typeof args.prompt === 'string' ? args.prompt : ''
            if (!prompt) {
              continue
            }
            promptByToolCallId.set(tool.toolCallId, prompt)
            if (tool.result && typeof tool.result === 'object') {
              const result = tool.result as Record<string, unknown>
              if (typeof result.subagentId === 'string') {
                promptBySubagentId.set(result.subagentId, prompt)
              }
            }
          }
        }
      }
      for (let index = 0; index < nextTimeline.length; index += 1) {
        const item = nextTimeline[index]
        if (item?.type !== 'subagent' || item.prompt) {
          continue
        }
        const fromTool =
          (item.toolCallId ? promptByToolCallId.get(item.toolCallId) : undefined) ??
          promptBySubagentId.get(item.subagentId)
        if (fromTool) {
          nextTimeline[index] = { ...item, prompt: fromTool }
        }
      }

      messages.value = nextMessages
      timeline.value = nextTimeline
      activeTurnId.value = null
      activeStepId.value = null
      pendingStepText.value = ''
      pendingQuestion.value = null
      editingMessageId.value = null
      editDraftText.value = ''
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
    pendingStepText.value = ''
    pendingQuestion.value = null
    editingMessageId.value = null
    editDraftText.value = ''
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
    pendingStepText.value = ''
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
    const leadingText = pendingStepText.value
    pendingStepText.value = ''
    const withStep = ensureStep(getActiveTurn() ?? current, stepId)
    if (leadingText) {
      const step =
        withStep.steps.find((item) => item.id === stepId) ?? createStep(stepId)
      patchActiveTurn(
        patchStep(withStep, stepId, {
          text: step.text + leadingText,
        }),
      )
      return
    }
    patchActiveTurn(withStep)
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

  const appendLocalTextDelta = (
    delta: string,
    messageId?: string,
    stepId?: string,
  ): void => {
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

    const targetStepId = stepId ?? activeStepId.value
    if (targetStepId) {
      const step =
        current.steps.find((item) => item.id === targetStepId) ??
        createStep(targetStepId)
      patchActiveTurn(
        patchStep(ensureStep(current, targetStepId), targetStepId, {
          text: step.text + delta,
        }),
      )
      return
    }

    pendingStepText.value += delta
  }

  const appendLocalReasoningDelta = (
    delta: string,
    messageId?: string,
    stepId?: string,
  ): void => {
    const turnId = messageId ?? activeTurnId.value
    if (!turnId) {
      return
    }
    if (turnId !== activeTurnId.value) {
      activeTurnId.value = turnId
    }
    const targetStepId = stepId ?? ensureActiveStep()
    if (stepId && activeStepId.value !== stepId) {
      activeStepId.value = stepId
    }
    const current =
      getActiveTurn() ??
      ({
        id: turnId,
        steps: [],
        text: '',
      } satisfies AgentTurn)
    const withStep = ensureStep(current, targetStepId)
    const step =
      withStep.steps.find((item) => item.id === targetStepId) ??
      createStep(targetStepId)
    patchActiveTurn(
      patchStep(withStep, targetStepId, {
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
      const trailingText = pendingStepText.value.trim()
      pendingStepText.value = ''
      patchActiveTurn({
        ...current,
        // Keep step.text so the UI can render chronological step order
        // (text before later tools). Only store out-of-step trailing text here.
        text: trailingText ? `${current.text}${trailingText}` : current.text,
        steps: current.steps.map((step) => closeRunningTools(step)),
      })
    } else {
      pendingStepText.value = ''
    }
    activeTurnId.value = null
    activeStepId.value = null
  }

  const setAgentTurnError = (turnError: AgentTurnError): void => {
    const current = getActiveTurn()
    if (current) {
      patchActiveTurn({ ...current, error: turnError })
      return
    }
    const last = timeline.value.at(-1)
    if (last?.type === 'agent-turn') {
      updateTimelineTurn({ ...last.turn, error: turnError })
    }
  }

  const patchMeta = (patch: Partial<ChatMeta>): void => {
    if (!meta.value) {
      return
    }
    meta.value = chatMetaSchema.parse({ ...meta.value, ...patch })
  }

  const reloadMeta = async (projectSlug: string, chatId: string): Promise<void> => {
    const record = await readChatMeta(projectSlug, chatId)
    meta.value = mapMeta(record)
  }

  const appendLocalTodoUpdate = (todos: TodoItem[]): void => {
    if (todos.length === 0) {
      return
    }
    timeline.value = upsertTodoTimelineItem(timeline.value, todos)
  }

  const upsertLocalSubagentStart = (subagent: {
    subagentId: string
    toolCallId?: string
    name: string
    blocking: boolean
    prompt?: string
    model?: string
  }): void => {
    timeline.value = upsertSubagentStart(timeline.value, subagent)
  }

  const appendLocalSubagentToolEvent = (
    subagentId: string,
    event: HarnessEvent,
  ): void => {
    timeline.value = appendSubagentToolEvent(timeline.value, subagentId, event)
  }

  const setLocalSubagentPrompt = (subagentId: string, prompt: string): void => {
    timeline.value = setSubagentPrompt(timeline.value, subagentId, prompt)
  }

  const completeLocalSubagent = (subagentId: string, summary: string): void => {
    timeline.value = completeSubagentTimelineItem(timeline.value, subagentId, summary)
  }

  const getSubagent = (subagentId: string): SubagentTimelineItem | null => {
    const item = timeline.value.find(
      (entry) => entry.type === 'subagent' && entry.subagentId === subagentId,
    )
    return item?.type === 'subagent' ? item : null
  }

  const setPendingQuestion = (question: PendingQuestionState): void => {
    pendingQuestion.value = question
  }

  const clearPendingQuestion = (): void => {
    pendingQuestion.value = null
  }

  const submitAnswer = (toolCallId: string, answer: string): void => {
    resolveQuestion(toolCallId, answer)
    if (pendingQuestion.value?.toolCallId === toolCallId) {
      pendingQuestion.value = null
    }
  }

  const todos = computed(() => {
    for (let index = timeline.value.length - 1; index >= 0; index -= 1) {
      const item = timeline.value[index]
      if (item?.type === 'todo') {
        return item.todos
      }
    }
    return []
  })

  const findUserMessage = (messageId: string): UIMessage | null => {
    const item = timeline.value.find(
      (entry) => entry.type === 'user' && entry.message.id === messageId,
    )
    return item?.type === 'user' ? item.message : null
  }

  const hasTimelineContentAfterMessage = (messageId: string): boolean => {
    const index = timeline.value.findIndex(
      (entry) => entry.type === 'user' && entry.message.id === messageId,
    )
    return index >= 0 && index < timeline.value.length - 1
  }

  const truncateTimelineBeforeMessage = (messageId: string): void => {
    const index = timeline.value.findIndex(
      (entry) => entry.type === 'user' && entry.message.id === messageId,
    )
    if (index < 0) {
      return
    }
    const nextTimeline = timeline.value.slice(0, index)
    timeline.value = nextTimeline
    messages.value = rebuildMessagesFromTimeline(nextTimeline)
    clearActiveTurnState()
  }

  const truncateTimelineAfterLastUserMessage = (): void => {
    let lastUserIndex = -1
    for (let index = timeline.value.length - 1; index >= 0; index -= 1) {
      if (timeline.value[index]?.type === 'user') {
        lastUserIndex = index
        break
      }
    }
    if (lastUserIndex < 0) {
      return
    }
    const nextTimeline = timeline.value.slice(0, lastUserIndex + 1)
    timeline.value = nextTimeline
    messages.value = rebuildMessagesFromTimeline(nextTimeline)
    clearActiveTurnState()
  }

  const getLastUserMessage = (): UIMessage | null => {
    for (let index = timeline.value.length - 1; index >= 0; index -= 1) {
      const item = timeline.value[index]
      if (item?.type === 'user') {
        return item.message
      }
    }
    return null
  }

  const clearChatState = (): void => {
    meta.value = null
    messages.value = []
    timeline.value = []
    loading.value = false
    editingMessageId.value = null
    editDraftText.value = ''
    clearActiveTurnState()
  }

  const beginEditMessage = (messageId: string): void => {
    const message = findUserMessage(messageId)
    if (!message) {
      return
    }
    editingMessageId.value = messageId
    editDraftText.value = extractUserMessageText(message)
  }

  const cancelEditMessage = (): void => {
    editingMessageId.value = null
    editDraftText.value = ''
  }

  const truncateBeforeMessage = async (
    projectSlug: string,
    chatId: string,
    messageId: string,
  ): Promise<void> => {
    await truncateChatLogBeforeMessage(projectSlug, chatId, messageId)
    truncateTimelineBeforeMessage(messageId)
  }

  const truncateAfterLastUserMessage = async (
    projectSlug: string,
    chatId: string,
  ): Promise<void> => {
    await truncateChatLogAfterLastUser(projectSlug, chatId)
    truncateTimelineAfterLastUserMessage()
  }

  const appendLocalCompaction = (summary: string, focus: string | null): void => {
    timeline.value = [...timeline.value, { type: 'compaction', summary, focus }]
  }

  const patchMetaActiveContext = (activeContext: {
    checkpointLineId: string
    includeFromCreatedAt: string
    summary: string
  }): void => {
    if (!meta.value) {
      return
    }
    meta.value = { ...meta.value, activeContext }
  }

  return {
    meta,
    messages,
    timeline,
    loading,
    chatId,
    pendingQuestion,
    todos,
    editingMessageId,
    editDraftText,
    loadChat,
    createNewChat,
    listProjectChats,
    clearChatState,
    patchMeta,
    reloadMeta,
    appendLocalMessage,
    startAgentTurn,
    startAgentStep,
    finishAgentStep,
    appendLocalTextDelta,
    appendLocalReasoningDelta,
    upsertLocalToolRun,
    finishAgentTurn,
    setAgentTurnError,
    appendLocalTodoUpdate,
    upsertLocalSubagentStart,
    appendLocalSubagentToolEvent,
    setLocalSubagentPrompt,
    completeLocalSubagent,
    getSubagent,
    setPendingQuestion,
    clearPendingQuestion,
    submitAnswer,
    hasTimelineContentAfterMessage,
    beginEditMessage,
    cancelEditMessage,
    truncateBeforeMessage,
    truncateAfterLastUserMessage,
    getLastUserMessage,
    appendLocalCompaction,
    patchMetaActiveContext,
  }
}
