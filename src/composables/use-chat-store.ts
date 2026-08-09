import { computed, ref, type ComputedRef, type Ref } from 'vue'
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
import {
  listPendingQuestionsForChat,
  resolveQuestion,
} from '@/services/harness/question-gate'
import { chatMetaSchema } from '@/schemas/chat-meta'
import { chatMessageLineSchema } from '@/schemas/chat-message-line'
import { fileDiffListSchema } from '@/schemas/file-diff'
import applySubagentToolEvent from '@/utils/apply-subagent-tool-event'
import mapSubagentResultStatus from '@/utils/map-subagent-result-status'
import {
  createChat,
  listChats,
  readChatMeta,
  readChatMessages,
  updateChatMeta,
} from '@/services/pyrola/pyrola-tauri'
import {
  truncateChatLogAfterLastUser,
  truncateChatLogBeforeMessage,
} from '@/services/chat/truncate-chat-log'

type MessagePart = UIMessage['parts'][number]

type ChatSession = {
  key: string
  projectSlug: string
  chatId: string
  warm: boolean
  meta: Ref<ChatMeta | null>
  messages: Ref<UIMessage[]>
  timeline: Ref<ChatTimelineItem[]>
  loading: Ref<boolean>
  activeTurnId: Ref<string | null>
  activeStepId: Ref<string | null>
  pendingStepText: Ref<string>
  pendingQuestion: Ref<PendingQuestionState | null>
  editingMessageId: Ref<string | null>
  editDraftText: Ref<string>
}

type SessionMutations = {
  meta: ComputedRef<ChatMeta | null>
  messages: ComputedRef<UIMessage[]>
  timeline: ComputedRef<ChatTimelineItem[]>
  pendingQuestion: ComputedRef<PendingQuestionState | null>
  todos: ComputedRef<TodoItem[]>
  patchMeta: (patch: Partial<ChatMeta>) => void
  reloadMeta: (projectSlug: string, chatId: string) => Promise<void>
  appendLocalMessage: (message: UIMessage) => void
  startAgentTurn: (turnId: string) => void
  startAgentStep: (stepId: string) => void
  finishAgentStep: () => void
  appendLocalTextDelta: (delta: string, messageId?: string, stepId?: string) => void
  appendLocalReasoningDelta: (delta: string, messageId?: string, stepId?: string) => void
  upsertLocalToolRun: (run: ToolRun) => void
  finishAgentTurn: () => void
  setAgentTurnError: (turnError: AgentTurnError) => void
  appendLocalTodoUpdate: (todos: TodoItem[]) => void
  upsertLocalSubagentStart: (subagent: {
    subagentId: string
    toolCallId?: string
    name: string
    blocking: boolean
    prompt?: string
    model?: string
  }) => void
  appendLocalSubagentToolEvent: (subagentId: string, event: HarnessEvent) => void
  setLocalSubagentPrompt: (subagentId: string, prompt: string) => void
  completeLocalSubagent: (
    subagentId: string,
    summary: string,
    status?: Exclude<SubagentTimelineItem['status'], 'running'>,
  ) => void
  getSubagent: (subagentId: string) => SubagentTimelineItem | null
  setPendingQuestion: (question: PendingQuestionState) => void
  clearPendingQuestion: () => void
  submitAnswer: (toolCallId: string, answer: string) => void
  hasTimelineContentAfterMessage: (messageId: string) => boolean
  beginEditMessage: (messageId: string) => void
  cancelEditMessage: () => void
  truncateBeforeMessage: (
    projectSlug: string,
    chatId: string,
    messageId: string,
  ) => Promise<void>
  truncateAfterLastUserMessage: (projectSlug: string, chatId: string) => Promise<void>
  getLastUserMessage: () => UIMessage | null
  appendLocalCompaction: (summary: string, focus: string | null) => void
  patchMetaActiveContext: (activeContext: {
    checkpointLineId: string
    includeFromCreatedAt: string
    summary: string
  }) => void
}

const sessions = new Map<string, ChatSession>()
const activeKey = ref<string | null>(null)

const makeSessionKey = (projectSlug: string, chatId: string): string =>
  `${projectSlug}::${chatId}`

const createSession = (projectSlug: string, chatId: string): ChatSession => ({
  key: makeSessionKey(projectSlug, chatId),
  projectSlug,
  chatId,
  warm: false,
  meta: ref<ChatMeta | null>(null),
  messages: ref<UIMessage[]>([]),
  timeline: ref<ChatTimelineItem[]>([]),
  loading: ref(false),
  activeTurnId: ref<string | null>(null),
  activeStepId: ref<string | null>(null),
  pendingStepText: ref(''),
  pendingQuestion: ref<PendingQuestionState | null>(null),
  editingMessageId: ref<string | null>(null),
  editDraftText: ref(''),
})

const getOrCreateSession = (projectSlug: string, chatId: string): ChatSession => {
  const key = makeSessionKey(projectSlug, chatId)
  const existing = sessions.get(key)
  if (existing) {
    return existing
  }
  const session = createSession(projectSlug, chatId)
  sessions.set(key, session)
  return session
}

const getActiveSession = (): ChatSession | null => {
  if (!activeKey.value) {
    return null
  }
  return sessions.get(activeKey.value) ?? null
}

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
  status: Exclude<SubagentTimelineItem['status'], 'running'> = 'done',
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
        status,
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
      status,
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
  attention?: ChatMeta['attention']
  createdAt: string
  updatedAt: string
  forkedFrom: string | null
  pinned: boolean
  pinnedAt: string | null
  prefixSnapshot?: ChatMeta['prefixSnapshot']
  activeContext?: ChatMeta['activeContext']
  awaitingPlanGo?: ChatMeta['awaitingPlanGo']
  subagentModel?: ChatMeta['subagentModel']
  reasoning?: ChatMeta['reasoning']
  subagentReasoning?: ChatMeta['subagentReasoning']
}): ChatMeta =>
  chatMetaSchema.parse({
    id: record.id,
    title: record.title,
    projectSlug: record.projectSlug,
    projectRoot: record.projectRoot,
    mode: record.mode,
    model: record.model,
    status: record.status,
    attention: record.attention,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    forkedFrom: record.forkedFrom,
    pinned: record.pinned,
    pinnedAt: record.pinnedAt,
    prefixSnapshot: record.prefixSnapshot,
    activeContext: record.activeContext,
    awaitingPlanGo: record.awaitingPlanGo,
    subagentModel: record.subagentModel,
    reasoning: record.reasoning,
    subagentReasoning: record.subagentReasoning,
  })

const parsePart = (part: Record<string, unknown>): MessagePart => {
  if (part.type === 'reasoning' && typeof part.text === 'string') {
    return { type: 'reasoning', text: part.text }
  }
  if (
    part.type === 'file' &&
    typeof part.url === 'string' &&
    typeof part.mediaType === 'string'
  ) {
    return {
      type: 'file',
      url: part.url,
      mediaType: part.mediaType,
      ...(typeof part.filename === 'string' ? { filename: part.filename } : {}),
    }
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
          status: 'done' as const,
          result: tool.result ?? { stopped: true },
        }
      : tool,
  ),
})

const updateTimelineTurn = (session: ChatSession, turn: AgentTurn): void => {
  const items = [...session.timeline.value]
  const index = items.findIndex(
    (item) => item.type === 'agent-turn' && item.turn.id === turn.id,
  )
  if (index >= 0) {
    items[index] = { type: 'agent-turn', turn }
    session.timeline.value = items
    return
  }
  session.timeline.value = [...items, { type: 'agent-turn', turn }]
}

const updateAssistantMessage = (session: ChatSession, turn: AgentTurn): void => {
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

  const index = session.messages.value.findIndex((message) => message.id === turn.id)
  const message: UIMessage = {
    id: turn.id,
    role: 'assistant',
    parts,
  }
  if (index >= 0) {
    session.messages.value = session.messages.value.map((item, itemIndex) =>
      itemIndex === index ? message : item,
    )
    return
  }
  session.messages.value = [...session.messages.value, message]
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

const clearActiveTurnState = (session: ChatSession): void => {
  session.activeTurnId.value = null
  session.activeStepId.value = null
  session.pendingStepText.value = ''
  session.pendingQuestion.value = null
}

const extractUserMessageText = (message: UIMessage): string =>
  message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')

const todosFromTimeline = (items: ChatTimelineItem[]): TodoItem[] => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    if (item?.type === 'todo') {
      return item.todos
    }
  }
  return []
}

const restorePendingQuestion = (session: ChatSession): void => {
  const pending = listPendingQuestionsForChat(session.chatId)
  const first = pending[0]
  if (!first) {
    session.pendingQuestion.value = null
    return
  }
  session.pendingQuestion.value = {
    toolCallId: first.toolCallId,
    question: first.question,
    options: first.options,
  }
}

const clearCompletedOrErrorAttention = async (session: ChatSession): Promise<void> => {
  const attention = session.meta.value?.attention
  if (attention !== 'completed' && attention !== 'error') {
    return
  }
  const record = await updateChatMeta(session.projectSlug, session.chatId, {
    attention: null,
  })
  session.meta.value = mapMeta(record)
}

const hydrateSessionFromDisk = async (session: ChatSession): Promise<void> => {
  const metaRecord = await readChatMeta(session.projectSlug, session.chatId)
  session.meta.value = mapMeta(metaRecord)
  const lines = await readChatMessages(session.projectSlug, session.chatId)
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
      const status = mapSubagentResultStatus(harnessEvent.outcome, summary)
      if (subagentId) {
        const inPending = pendingSubagents.some(
          (item) => item.type === 'subagent' && item.subagentId === subagentId,
        )
        if (inPending) {
          pendingSubagents = completeSubagentTimelineItem(
            pendingSubagents,
            subagentId,
            summary,
            status,
          )
        } else {
          const merged = completeSubagentTimelineItem(
            nextTimeline,
            subagentId,
            summary,
            status,
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
          ...(parsed.mentionHighlights && parsed.mentionHighlights.length > 0
            ? { mentionHighlights: parsed.mentionHighlights }
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

  session.messages.value = nextMessages
  session.timeline.value = nextTimeline
  session.activeTurnId.value = null
  session.activeStepId.value = null
  session.pendingStepText.value = ''
  session.pendingQuestion.value = null
  session.editingMessageId.value = null
  session.editDraftText.value = ''
  session.warm = true
}

const sessionBindings = new WeakMap<ChatSession, SessionMutations>()

const createSessionMutations = (session: ChatSession): SessionMutations => {
  const getActiveTurn = (): AgentTurn | null => {
    if (!session.activeTurnId.value) {
      return null
    }
    const item = session.timeline.value.find(
      (entry) =>
        entry.type === 'agent-turn' && entry.turn.id === session.activeTurnId.value,
    )
    return item?.type === 'agent-turn' ? item.turn : null
  }

  const patchActiveTurn = (turn: AgentTurn): void => {
    updateTimelineTurn(session, turn)
    updateAssistantMessage(session, turn)
  }

  const startAgentStep = (stepId: string): void => {
    const current = getActiveTurn()
    if (!current) {
      return
    }
    if (session.activeStepId.value && session.activeStepId.value !== stepId) {
      const index = getStepIndex(current, session.activeStepId.value)
      if (index >= 0) {
        const steps = [...current.steps]
        steps[index] = closeRunningTools(steps[index]!)
        patchActiveTurn({ ...current, steps })
      }
    }
    session.activeStepId.value = stepId
    const leadingText = session.pendingStepText.value
    session.pendingStepText.value = ''
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
    if (!current || !session.activeStepId.value) {
      return
    }
    const index = getStepIndex(current, session.activeStepId.value)
    if (index >= 0) {
      const steps = [...current.steps]
      steps[index] = closeRunningTools(steps[index]!)
      patchActiveTurn({ ...current, steps })
    }
    session.activeStepId.value = null
  }

  const ensureActiveStep = (): string => {
    if (session.activeStepId.value) {
      return session.activeStepId.value
    }
    const stepId = crypto.randomUUID()
    startAgentStep(stepId)
    return stepId
  }

  const findUserMessage = (messageId: string): UIMessage | null => {
    const item = session.timeline.value.find(
      (entry) => entry.type === 'user' && entry.message.id === messageId,
    )
    return item?.type === 'user' ? item.message : null
  }

  const truncateTimelineBeforeMessage = (messageId: string): void => {
    const index = session.timeline.value.findIndex(
      (entry) => entry.type === 'user' && entry.message.id === messageId,
    )
    if (index < 0) {
      return
    }
    const nextTimeline = session.timeline.value.slice(0, index)
    session.timeline.value = nextTimeline
    session.messages.value = rebuildMessagesFromTimeline(nextTimeline)
    clearActiveTurnState(session)
  }

  const truncateTimelineAfterLastUserMessage = (): void => {
    let lastUserIndex = -1
    for (let index = session.timeline.value.length - 1; index >= 0; index -= 1) {
      if (session.timeline.value[index]?.type === 'user') {
        lastUserIndex = index
        break
      }
    }
    if (lastUserIndex < 0) {
      return
    }
    const nextTimeline = session.timeline.value.slice(0, lastUserIndex + 1)
    session.timeline.value = nextTimeline
    session.messages.value = rebuildMessagesFromTimeline(nextTimeline)
    clearActiveTurnState(session)
  }

  return {
    meta: computed(() => session.meta.value),
    messages: computed(() => session.messages.value),
    timeline: computed(() => session.timeline.value),
    pendingQuestion: computed(() => session.pendingQuestion.value),
    todos: computed(() => todosFromTimeline(session.timeline.value)),
    patchMeta: (patch: Partial<ChatMeta>): void => {
      if (!session.meta.value) {
        return
      }
      session.meta.value = chatMetaSchema.parse({ ...session.meta.value, ...patch })
    },
    reloadMeta: async (projectSlug: string, chatId: string): Promise<void> => {
      const record = await readChatMeta(projectSlug, chatId)
      session.meta.value = mapMeta(record)
    },
    appendLocalMessage: (message: UIMessage): void => {
      session.messages.value = [...session.messages.value, message]
      if (message.role === 'user') {
        session.timeline.value = [...session.timeline.value, { type: 'user', message }]
      }
    },
    startAgentTurn: (turnId: string): void => {
      session.activeTurnId.value = turnId
      session.activeStepId.value = null
      session.pendingStepText.value = ''
      const turn: AgentTurn = {
        id: turnId,
        steps: [],
        text: '',
      }
      session.timeline.value = [...session.timeline.value, { type: 'agent-turn', turn }]
    },
    startAgentStep,
    finishAgentStep,
    appendLocalTextDelta: (
      delta: string,
      messageId?: string,
      stepId?: string,
    ): void => {
      const turnId = messageId ?? session.activeTurnId.value
      if (!turnId) {
        return
      }
      if (turnId !== session.activeTurnId.value) {
        session.activeTurnId.value = turnId
      }
      const current =
        getActiveTurn() ??
        ({
          id: turnId,
          steps: [],
          text: '',
        } satisfies AgentTurn)

      const targetStepId = stepId ?? session.activeStepId.value
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

      session.pendingStepText.value += delta
    },
    appendLocalReasoningDelta: (
      delta: string,
      messageId?: string,
      stepId?: string,
    ): void => {
      const turnId = messageId ?? session.activeTurnId.value
      if (!turnId) {
        return
      }
      if (turnId !== session.activeTurnId.value) {
        session.activeTurnId.value = turnId
      }
      const targetStepId = stepId ?? ensureActiveStep()
      if (stepId && session.activeStepId.value !== stepId) {
        session.activeStepId.value = stepId
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
    },
    upsertLocalToolRun: (run: ToolRun): void => {
      const current = getActiveTurn()
      if (!current) {
        return
      }
      const stepId = ensureActiveStep()
      const step =
        current.steps.find((item) => item.id === stepId) ?? createStep(stepId)
      patchActiveTurn(patchStep(current, stepId, upsertToolInStep(step, run)))
    },
    finishAgentTurn: (): void => {
      finishAgentStep()
      const current = getActiveTurn()
      if (current) {
        const trailingText = session.pendingStepText.value.trim()
        session.pendingStepText.value = ''
        patchActiveTurn({
          ...current,
          // Keep step.text so the UI can render chronological step order
          // (text before later tools). Only store out-of-step trailing text here.
          text: trailingText ? `${current.text}${trailingText}` : current.text,
          steps: current.steps.map((step) => closeRunningTools(step)),
        })
      } else {
        session.pendingStepText.value = ''
      }
      session.activeTurnId.value = null
      session.activeStepId.value = null
    },
    setAgentTurnError: (turnError: AgentTurnError): void => {
      const current = getActiveTurn()
      if (current) {
        patchActiveTurn({ ...current, error: turnError })
        return
      }
      const last = session.timeline.value.at(-1)
      if (last?.type === 'agent-turn') {
        updateTimelineTurn(session, { ...last.turn, error: turnError })
      }
    },
    appendLocalTodoUpdate: (todos: TodoItem[]): void => {
      if (todos.length === 0) {
        return
      }
      session.timeline.value = upsertTodoTimelineItem(session.timeline.value, todos)
    },
    upsertLocalSubagentStart: (subagent: {
      subagentId: string
      toolCallId?: string
      name: string
      blocking: boolean
      prompt?: string
      model?: string
    }): void => {
      session.timeline.value = upsertSubagentStart(session.timeline.value, subagent)
    },
    appendLocalSubagentToolEvent: (
      subagentId: string,
      event: HarnessEvent,
    ): void => {
      session.timeline.value = appendSubagentToolEvent(
        session.timeline.value,
        subagentId,
        event,
      )
    },
    setLocalSubagentPrompt: (subagentId: string, prompt: string): void => {
      session.timeline.value = setSubagentPrompt(session.timeline.value, subagentId, prompt)
    },
    completeLocalSubagent: (
      subagentId: string,
      summary: string,
      status: Exclude<SubagentTimelineItem['status'], 'running'> = 'done',
    ): void => {
      session.timeline.value = completeSubagentTimelineItem(
        session.timeline.value,
        subagentId,
        summary,
        status,
      )
    },
    getSubagent: (subagentId: string): SubagentTimelineItem | null => {
      const item = session.timeline.value.find(
        (entry) => entry.type === 'subagent' && entry.subagentId === subagentId,
      )
      return item?.type === 'subagent' ? item : null
    },
    setPendingQuestion: (question: PendingQuestionState): void => {
      session.pendingQuestion.value = question
    },
    clearPendingQuestion: (): void => {
      session.pendingQuestion.value = null
    },
    submitAnswer: (toolCallId: string, answer: string): void => {
      resolveQuestion(toolCallId, answer)
      if (session.pendingQuestion.value?.toolCallId === toolCallId) {
        session.pendingQuestion.value = null
      }
    },
    hasTimelineContentAfterMessage: (messageId: string): boolean => {
      const index = session.timeline.value.findIndex(
        (entry) => entry.type === 'user' && entry.message.id === messageId,
      )
      return index >= 0 && index < session.timeline.value.length - 1
    },
    beginEditMessage: (messageId: string): void => {
      const message = findUserMessage(messageId)
      if (!message) {
        return
      }
      session.editingMessageId.value = messageId
      session.editDraftText.value = extractUserMessageText(message)
    },
    cancelEditMessage: (): void => {
      session.editingMessageId.value = null
      session.editDraftText.value = ''
    },
    truncateBeforeMessage: async (
      projectSlug: string,
      chatId: string,
      messageId: string,
    ): Promise<void> => {
      await truncateChatLogBeforeMessage(projectSlug, chatId, messageId)
      truncateTimelineBeforeMessage(messageId)
    },
    truncateAfterLastUserMessage: async (
      projectSlug: string,
      chatId: string,
    ): Promise<void> => {
      await truncateChatLogAfterLastUser(projectSlug, chatId)
      truncateTimelineAfterLastUserMessage()
    },
    getLastUserMessage: (): UIMessage | null => {
      for (let index = session.timeline.value.length - 1; index >= 0; index -= 1) {
        const item = session.timeline.value[index]
        if (item?.type === 'user') {
          return item.message
        }
      }
      return null
    },
    appendLocalCompaction: (summary: string, focus: string | null): void => {
      session.timeline.value = [
        ...session.timeline.value,
        { type: 'compaction', summary, focus },
      ]
    },
    patchMetaActiveContext: (activeContext: {
      checkpointLineId: string
      includeFromCreatedAt: string
      summary: string
    }): void => {
      if (!session.meta.value) {
        return
      }
      session.meta.value = { ...session.meta.value, activeContext }
    },
  }
}

const bindSessionMutations = (session: ChatSession): SessionMutations => {
  const existing = sessionBindings.get(session)
  if (existing) {
    return existing
  }
  const bound = createSessionMutations(session)
  sessionBindings.set(session, bound)
  return bound
}

const withActiveSession = <T>(
  fallback: T,
  run: (session: ChatSession, api: SessionMutations) => T,
): T => {
  const session = getActiveSession()
  if (!session) {
    return fallback
  }
  return run(session, bindSessionMutations(session))
}

export const resetChatSessionsForTests = (): void => {
  sessions.clear()
  activeKey.value = null
}

export default () => {
  const meta = computed(() => getActiveSession()?.meta.value ?? null)
  const messages = computed(() => getActiveSession()?.messages.value ?? [])
  const timeline = computed(() => getActiveSession()?.timeline.value ?? [])
  const loading = computed(() => getActiveSession()?.loading.value ?? false)
  const pendingQuestion = computed(
    () => getActiveSession()?.pendingQuestion.value ?? null,
  )
  const editingMessageId = computed(
    () => getActiveSession()?.editingMessageId.value ?? null,
  )
  const editDraftText = computed(() => getActiveSession()?.editDraftText.value ?? '')
  const chatId = computed(() => meta.value?.id ?? null)
  const todos = computed(() => todosFromTimeline(timeline.value))

  const forChat = (projectSlug: string, chatIdValue: string): SessionMutations =>
    bindSessionMutations(getOrCreateSession(projectSlug, chatIdValue))

  const isSessionActive = (projectSlug: string, chatIdValue: string): boolean =>
    activeKey.value === makeSessionKey(projectSlug, chatIdValue)

  const isSessionWarm = (projectSlug: string, chatIdValue: string): boolean => {
    const session = sessions.get(makeSessionKey(projectSlug, chatIdValue))
    return Boolean(session?.warm)
  }

  const selectChat = (projectSlug: string, chatIdValue: string): SessionMutations => {
    const session = getOrCreateSession(projectSlug, chatIdValue)
    activeKey.value = session.key
    return bindSessionMutations(session)
  }

  const dropSession = (projectSlug: string, chatIdValue: string): void => {
    const key = makeSessionKey(projectSlug, chatIdValue)
    sessions.delete(key)
    if (activeKey.value === key) {
      activeKey.value = null
    }
  }

  const ensureChatHydrated = async (
    projectSlug: string,
    chatIdValue: string,
  ): Promise<'keepLive' | 'warmIdle' | 'cold'> => {
    const session = getOrCreateSession(projectSlug, chatIdValue)
    activeKey.value = session.key

    const keepLive =
      session.warm &&
      (session.meta.value?.status === 'running' || session.activeTurnId.value !== null)

    if (keepLive) {
      session.loading.value = true
      try {
        const metaRecord = await readChatMeta(projectSlug, chatIdValue)
        session.meta.value = mapMeta(metaRecord)
        await clearCompletedOrErrorAttention(session)
        restorePendingQuestion(session)
      } finally {
        session.loading.value = false
      }
      return 'keepLive'
    }

    // Idle warm: in-memory timeline is already the navigation cache. Skip
    // full jsonl rebuild. Optional meta refresh stays off the paint path.
    if (session.warm) {
      return 'warmIdle'
    }

    session.loading.value = true
    try {
      await hydrateSessionFromDisk(session)
      await clearCompletedOrErrorAttention(session)
      restorePendingQuestion(session)
    } finally {
      session.loading.value = false
    }
    return 'cold'
  }

  const refreshChatMeta = async (
    projectSlug: string,
    chatIdValue: string,
  ): Promise<void> => {
    const session = getOrCreateSession(projectSlug, chatIdValue)
    const metaRecord = await readChatMeta(projectSlug, chatIdValue)
    session.meta.value = mapMeta(metaRecord)
    await clearCompletedOrErrorAttention(session)
    restorePendingQuestion(session)
  }

  const loadChat = async (projectSlug: string, chatIdValue: string): Promise<void> => {
    selectChat(projectSlug, chatIdValue)
    await ensureChatHydrated(projectSlug, chatIdValue)
  }

  const createNewChat = async (args: {
    projectSlug: string
    projectRoot: string
    mode: PyrolaChatMode
    model: string
    title?: string
  }): Promise<ChatMeta> => {
    const record = await createChat(args)
    const session = getOrCreateSession(record.projectSlug, record.id)
    session.meta.value = mapMeta(record)
    session.messages.value = []
    session.timeline.value = []
    session.activeTurnId.value = null
    session.activeStepId.value = null
    session.pendingStepText.value = ''
    session.pendingQuestion.value = null
    session.editingMessageId.value = null
    session.editDraftText.value = ''
    session.warm = true
    activeKey.value = session.key
    return session.meta.value
  }

  const listProjectChats = async (projectSlug: string): Promise<ChatMeta[]> => {
    const records = await listChats(projectSlug)
    return records.map(mapMeta)
  }

  const clearChatState = (): void => {
    activeKey.value = null
  }

  const patchMeta = (patch: Partial<ChatMeta>): void => {
    withActiveSession(undefined, (_session, api) => {
      api.patchMeta(patch)
    })
  }

  const reloadMeta = async (projectSlug: string, chatIdValue: string): Promise<void> => {
    const session = getActiveSession()
    if (!session) {
      return
    }
    await bindSessionMutations(session).reloadMeta(projectSlug, chatIdValue)
  }

  const appendLocalMessage = (message: UIMessage): void => {
    withActiveSession(undefined, (_session, api) => {
      api.appendLocalMessage(message)
    })
  }

  const startAgentTurn = (turnId: string): void => {
    withActiveSession(undefined, (_session, api) => {
      api.startAgentTurn(turnId)
    })
  }

  const startAgentStep = (stepId: string): void => {
    withActiveSession(undefined, (_session, api) => {
      api.startAgentStep(stepId)
    })
  }

  const finishAgentStep = (): void => {
    withActiveSession(undefined, (_session, api) => {
      api.finishAgentStep()
    })
  }

  const appendLocalTextDelta = (
    delta: string,
    messageId?: string,
    stepId?: string,
  ): void => {
    withActiveSession(undefined, (_session, api) => {
      api.appendLocalTextDelta(delta, messageId, stepId)
    })
  }

  const appendLocalReasoningDelta = (
    delta: string,
    messageId?: string,
    stepId?: string,
  ): void => {
    withActiveSession(undefined, (_session, api) => {
      api.appendLocalReasoningDelta(delta, messageId, stepId)
    })
  }

  const upsertLocalToolRun = (run: ToolRun): void => {
    withActiveSession(undefined, (_session, api) => {
      api.upsertLocalToolRun(run)
    })
  }

  const finishAgentTurn = (): void => {
    withActiveSession(undefined, (_session, api) => {
      api.finishAgentTurn()
    })
  }

  const setAgentTurnError = (turnError: AgentTurnError): void => {
    withActiveSession(undefined, (_session, api) => {
      api.setAgentTurnError(turnError)
    })
  }

  const appendLocalTodoUpdate = (todosValue: TodoItem[]): void => {
    withActiveSession(undefined, (_session, api) => {
      api.appendLocalTodoUpdate(todosValue)
    })
  }

  const upsertLocalSubagentStart = (subagent: {
    subagentId: string
    toolCallId?: string
    name: string
    blocking: boolean
    prompt?: string
    model?: string
  }): void => {
    withActiveSession(undefined, (_session, api) => {
      api.upsertLocalSubagentStart(subagent)
    })
  }

  const appendLocalSubagentToolEvent = (
    subagentId: string,
    event: HarnessEvent,
  ): void => {
    withActiveSession(undefined, (_session, api) => {
      api.appendLocalSubagentToolEvent(subagentId, event)
    })
  }

  const setLocalSubagentPrompt = (subagentId: string, prompt: string): void => {
    withActiveSession(undefined, (_session, api) => {
      api.setLocalSubagentPrompt(subagentId, prompt)
    })
  }

  const completeLocalSubagent = (
    subagentId: string,
    summary: string,
    status?: Exclude<SubagentTimelineItem['status'], 'running'>,
  ): void => {
    withActiveSession(undefined, (_session, api) => {
      api.completeLocalSubagent(subagentId, summary, status)
    })
  }

  const getSubagent = (subagentId: string): SubagentTimelineItem | null =>
    withActiveSession(null, (_session, api) => api.getSubagent(subagentId))

  const setPendingQuestion = (question: PendingQuestionState): void => {
    withActiveSession(undefined, (_session, api) => {
      api.setPendingQuestion(question)
    })
  }

  const clearPendingQuestion = (): void => {
    withActiveSession(undefined, (_session, api) => {
      api.clearPendingQuestion()
    })
  }

  const submitAnswer = (toolCallId: string, answer: string): void => {
    resolveQuestion(toolCallId, answer)
    const session = getActiveSession()
    if (session?.pendingQuestion.value?.toolCallId === toolCallId) {
      session.pendingQuestion.value = null
    }
  }

  const hasTimelineContentAfterMessage = (messageId: string): boolean =>
    withActiveSession(false, (_session, api) =>
      api.hasTimelineContentAfterMessage(messageId),
    )

  const beginEditMessage = (messageId: string): void => {
    withActiveSession(undefined, (_session, api) => {
      api.beginEditMessage(messageId)
    })
  }

  const cancelEditMessage = (): void => {
    withActiveSession(undefined, (_session, api) => {
      api.cancelEditMessage()
    })
  }

  const truncateBeforeMessage = async (
    projectSlug: string,
    chatIdValue: string,
    messageId: string,
  ): Promise<void> => {
    const session = getActiveSession()
    if (!session) {
      return
    }
    await bindSessionMutations(session).truncateBeforeMessage(
      projectSlug,
      chatIdValue,
      messageId,
    )
  }

  const truncateAfterLastUserMessage = async (
    projectSlug: string,
    chatIdValue: string,
  ): Promise<void> => {
    const session = getActiveSession()
    if (!session) {
      return
    }
    await bindSessionMutations(session).truncateAfterLastUserMessage(
      projectSlug,
      chatIdValue,
    )
  }

  const getLastUserMessage = (): UIMessage | null =>
    withActiveSession(null, (_session, api) => api.getLastUserMessage())

  const appendLocalCompaction = (summary: string, focus: string | null): void => {
    withActiveSession(undefined, (_session, api) => {
      api.appendLocalCompaction(summary, focus)
    })
  }

  const patchMetaActiveContext = (activeContext: {
    checkpointLineId: string
    includeFromCreatedAt: string
    summary: string
  }): void => {
    withActiveSession(undefined, (_session, api) => {
      api.patchMetaActiveContext(activeContext)
    })
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
    activeKey,
    forChat,
    isSessionActive,
    isSessionWarm,
    selectChat,
    dropSession,
    ensureChatHydrated,
    refreshChatMeta,
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
