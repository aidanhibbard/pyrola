import type { ChatStatus, ModelMessage, UIMessage } from 'ai'
import { convertToModelMessages, smoothStream, stepCountIs, streamText } from 'ai'
import type { HarnessEvent, TodoItem } from '@/types/harness/harness-event'
import type { ChatArtifact } from '@/types/chat/chat-artifact'
import type { ContextMention } from '@/types/harness/context-mention'
import type { PyrolaChatMode, PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import type { SubagentResult } from '@/types/harness/subagent-record'
import createModel from '@/services/providers/create-model'
import {
  appendChatLine,
  updateChatMeta,
} from '@/services/pyrola/pyrola-tauri'
import assembleSystemPrompt from '@/services/harness/system-prompt-assembler'
import countContextBudget from '@/services/context/count-context-budget'
import buildTools from '@/services/harness/build-tools'
import { MODE_TOOL_ALLOWLIST } from '@/services/harness/mode-allowlists'
import { rejectAllPending } from '@/services/harness/approval-gate'
import { rejectAllPendingQuestions } from '@/services/harness/question-gate'
import runSideTask from '@/services/harness/run-side-task'
import enrichToolError from '@/services/harness/enrich-tool-error'
import deriveToolArtifact from '@/services/harness/derive-tool-artifact'
import { fileDiffListSchema } from '@/schemas/file-diff'
import type { FileDiff } from '@/types/harness/file-diff'
import deriveChatTitle, { isDefaultChatTitle } from '@/utils/derive-chat-title'
import {
  killShellsForChat,
  setAgentShellEventEmitter,
} from '@/services/harness/agent-shell-registry'
import {
  abort as abortSubagentsForChat,
  clearTurnResponseMessages,
  getTurnResponseMessages,
  hasRunningSubagentsForChat,
  setTurnResponseMessages,
} from '@/services/harness/subagent-registry'

export type OrchestratorInput = {
  projectSlug: string
  chatId: string
  projectRoot: string
  projectName: string
  mode: PyrolaChatMode
  modelId: string
  providerId: string
  settings: PyrolaSettings
  messages: UIMessage[]
  userText: string
  mentions: ContextMention[]
  signal: AbortSignal
  onEvent: (event: HarnessEvent) => void
  assistantId?: string
  skipUserPersist?: boolean
}

export type ResumeOrchestratorInput = Omit<
  OrchestratorInput,
  'userText' | 'skipUserPersist'
> & {
  toolCallId: string
  completedResult: SubagentResult
  skipUserPersist: true
}

const MAX_OUTPUT_TOKENS = 8192
const MAX_CONSECUTIVE_TOOL_ERRORS = 5

const nowIso = (): string => new Date().toISOString()

const persistLine = async (
  projectSlug: string,
  chatId: string,
  line: Record<string, unknown>,
): Promise<void> => {
  await appendChatLine(projectSlug, chatId, line)
}

const deriveToolDiffs = (result: unknown): FileDiff[] | undefined => {
  if (!result || typeof result !== 'object') {
    return undefined
  }
  const record = result as Record<string, unknown>
  if (!Array.isArray(record.diffs)) {
    return undefined
  }
  const parsed = fileDiffListSchema.safeParse(record.diffs)
  if (!parsed.success) {
    return undefined
  }
  return parsed.data
}

const persistToolRun = async (
  projectSlug: string,
  chatId: string,
  toolCallId: string,
  name: string,
  status: 'running' | 'done' | 'error' | 'rejected',
  stepId: string,
  args?: unknown,
  result?: unknown,
  artifact?: ChatArtifact,
  diffs?: FileDiff[],
): Promise<void> => {
  await persistLine(projectSlug, chatId, {
    id: toolCallId,
    role: 'assistant',
    parts: [],
    createdAt: nowIso(),
    harnessEvent: {
      type: 'tool-run',
      toolCallId,
      name,
      status,
      stepId,
      args,
      result,
      ...(artifact ? { artifact } : {}),
      ...(diffs ? { diffs } : {}),
    },
  })
}

const persistStepBoundary = async (
  projectSlug: string,
  chatId: string,
  stepId: string,
  action: 'start' | 'finish',
): Promise<void> => {
  await persistLine(projectSlug, chatId, {
    id: stepId,
    role: 'assistant',
    parts: [],
    createdAt: nowIso(),
    harnessEvent: {
      type: 'step-boundary',
      stepId,
      action,
    },
  })
}

const parseTodoUpdate = (name: string, result: unknown): TodoItem[] | null => {
  if (name !== 'create_plan' && name !== 'update_plan_todo') {
    return null
  }
  if (!result || typeof result !== 'object' || !('todos' in result)) {
    return null
  }
  const todos = (result as { todos: unknown }).todos
  if (!Array.isArray(todos)) {
    return null
  }
  return todos as TodoItem[]
}

const persistTodoUpdate = async (
  projectSlug: string,
  chatId: string,
  todos: TodoItem[],
): Promise<void> => {
  await persistLine(projectSlug, chatId, {
    id: crypto.randomUUID(),
    role: 'assistant',
    parts: [],
    createdAt: nowIso(),
    harnessEvent: {
      type: 'todo-update',
      todos,
    },
  })
}

const persistSubagentHarnessEvent = async (
  projectSlug: string,
  chatId: string,
  event:
    | Extract<HarnessEvent, { type: 'subagent-start' }>
    | Extract<HarnessEvent, { type: 'subagent-result' }>,
): Promise<void> => {
  const lineId =
    event.type === 'subagent-start'
      ? event.subagentId
      : `${event.subagentId}-result`
  await persistLine(projectSlug, chatId, {
    id: lineId,
    role: 'assistant',
    parts: [],
    createdAt: nowIso(),
    harnessEvent: event,
  })
}

const persistPendingSubagent = async (
  projectSlug: string,
  chatId: string,
  event: Extract<HarnessEvent, { type: 'pending-subagent' }>,
): Promise<void> => {
  await persistLine(projectSlug, chatId, {
    id: `${event.subagentId}-pending`,
    role: 'assistant',
    parts: [],
    createdAt: nowIso(),
    harnessEvent: event,
  })
}

const persistStepText = async (
  projectSlug: string,
  chatId: string,
  stepId: string,
  text: string,
): Promise<void> => {
  if (!text.trim()) {
    return
  }
  await persistLine(projectSlug, chatId, {
    id: `${stepId}-text`,
    role: 'assistant',
    parts: [],
    createdAt: nowIso(),
    harnessEvent: {
      type: 'step-text',
      stepId,
      text,
    },
  })
}

const filterToolsForMode = (
  mode: PyrolaChatMode,
  tools: ReturnType<typeof buildTools>,
): Partial<ReturnType<typeof buildTools>> => {
  const allow = new Set(MODE_TOOL_ALLOWLIST[mode])
  const entries = Object.entries(tools).filter(([name]) => allow.has(name))
  return Object.fromEntries(entries) as Partial<ReturnType<typeof buildTools>>
}

const resolveStreamError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error
  }
  return new Error('Model stream failed')
}

const resolveToolErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return 'Tool execution failed'
  }
}

const patchSubagentToolResult = (
  messages: ModelMessage[],
  toolCallId: string,
  completedResult: SubagentResult,
): ModelMessage[] =>
  messages.map((message) => {
    if (message.role !== 'tool' || !Array.isArray(message.content)) {
      return message
    }
    return {
      ...message,
      content: message.content.map((part) => {
        if (part.type !== 'tool-result' || part.toolCallId !== toolCallId) {
          return part
        }
        return {
          ...part,
          output: {
            type: 'json' as const,
            value: completedResult,
          },
        }
      }),
    }
  })

type HarnessStreamInput = {
  projectSlug: string
  chatId: string
  projectRoot: string
  projectName: string
  mode: PyrolaChatMode
  modelId: string
  providerId: string
  settings: PyrolaSettings
  mentions: ContextMention[]
  messages: UIMessage[]
  modelMessages: ModelMessage[]
  signal: AbortSignal
  onEvent: (event: HarnessEvent) => void
  assistantId: string
  captureTurnMessages: boolean
}

const runHarnessStream = async (input: HarnessStreamInput): Promise<void> => {
  const {
    projectSlug,
    chatId,
    projectRoot,
    projectName,
    mode,
    modelId,
    providerId,
    settings,
    mentions,
    messages,
    modelMessages,
    signal,
    onEvent,
    assistantId,
    captureTurnMessages,
  } = input

  setAgentShellEventEmitter(onEvent)

  onEvent({
    type: 'chat-status-changed',
    projectSlug,
    chatId,
    status: 'running',
  })
  await updateChatMeta(projectSlug, chatId, { status: 'running' })

  const system = await assembleSystemPrompt({
    mode,
    projectName,
    projectRoot,
    mentions,
    agentCatalog: [],
  })

  const budget = await countContextBudget({
    modelId,
    mode,
    projectName,
    projectRoot,
    mentions,
    messages,
  })
  onEvent({
    type: 'context-budget',
    modelId,
    used: budget.used,
    limit: budget.limit,
    buckets: budget.buckets,
  })

  const model = await createModel({ providerId, modelId, settings })

  const handleHarnessEvent = (event: HarnessEvent): void => {
    if (event.type === 'subagent-start' || event.type === 'subagent-result') {
      void persistSubagentHarnessEvent(projectSlug, chatId, event)
    }
    if (event.type === 'pending-subagent') {
      void persistPendingSubagent(projectSlug, chatId, event)
    }
    onEvent(event)
  }

  const allTools = buildTools({
    projectRoot,
    projectSlug,
    chatId,
    settings,
    onPendingApproval: (toolCallId, name, diff) => {
      onEvent({ type: 'tool-pending-approval', toolCallId, name, diff })
    },
    onHarnessEvent: handleHarnessEvent,
    signal,
  })
  const tools = filterToolsForMode(mode, allTools)

  let trailingText = ''
  let assistantReasoning = ''
  let stepCount = 0
  let streamError: Error | null = null
  let consecutiveToolErrors = 0
  let currentStepId = ''
  let currentStepText = ''
  let stepOpen = false
  const startedToolIds = new Set<string>()
  const completedToolIds = new Set<string>()

  const beginStep = async (): Promise<void> => {
    if (stepOpen) {
      await finishStep()
    }
    currentStepId = crypto.randomUUID()
    currentStepText = ''
    stepOpen = true
    onEvent({ type: 'step-start', stepId: currentStepId })
    await persistStepBoundary(projectSlug, chatId, currentStepId, 'start')
  }

  const finishStep = async (): Promise<void> => {
    if (!stepOpen) {
      return
    }
    if (currentStepText.trim()) {
      await persistStepText(projectSlug, chatId, currentStepId, currentStepText)
    }
    onEvent({ type: 'step-finish', stepId: currentStepId })
    await persistStepBoundary(projectSlug, chatId, currentStepId, 'finish')
    stepCount += 1
    currentStepText = ''
    stepOpen = false
  }

  const ensureStepOpen = async (): Promise<void> => {
    if (!stepOpen) {
      await beginStep()
    }
  }

  const emitToolStart = async (
    toolCallId: string,
    name: string,
    args: unknown,
  ): Promise<void> => {
    if (startedToolIds.has(toolCallId)) {
      return
    }
    startedToolIds.add(toolCallId)
    onEvent({ type: 'tool-start', toolCallId, name, args })
    await persistToolRun(
      projectSlug,
      chatId,
      toolCallId,
      name,
      'running',
      currentStepId,
      args,
    )
  }

  const emitToolResult = async (
    toolCallId: string,
    name: string,
    result: unknown,
    isError = false,
    args?: unknown,
  ): Promise<void> => {
    if (completedToolIds.has(toolCallId)) {
      return
    }
    completedToolIds.add(toolCallId)
    const artifact = deriveToolArtifact(name, result, args, isError)
    const diffs = isError ? undefined : deriveToolDiffs(result)
    onEvent({
      type: 'tool-result',
      toolCallId,
      result,
      isError,
      ...(artifact ? { artifact } : {}),
      ...(diffs ? { diffs } : {}),
    })
    await persistToolRun(
      projectSlug,
      chatId,
      toolCallId,
      name,
      isError ? 'error' : 'done',
      currentStepId,
      args,
      result,
      artifact,
      diffs,
    )
    if (!isError) {
      const todos = parseTodoUpdate(name, result)
      if (todos) {
        onEvent({ type: 'todo-update', todos })
        await persistTodoUpdate(projectSlug, chatId, todos)
      }
    }
  }

  try {
    const result = streamText({
      model,
      instructions: system,
      messages: modelMessages,
      tools,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      experimental_transform: smoothStream({ chunking: 'word' }),
      stopWhen: stepCountIs(25),
      abortSignal: signal,
      onAbort: async () => {
        rejectAllPending()
        rejectAllPendingQuestions()
        await killShellsForChat(chatId)
        abortSubagentsForChat(chatId)
        if (trailingText || assistantReasoning) {
          await persistLine(projectSlug, chatId, {
            id: assistantId,
            role: 'assistant',
            parts: [
              ...(assistantReasoning
                ? [{ type: 'reasoning', text: assistantReasoning }]
                : []),
              ...(trailingText ? [{ type: 'text', text: trailingText }] : []),
            ],
            createdAt: nowIso(),
            aborted: true,
          })
        }
        onEvent({
          type: 'turn-aborted',
          reason: 'user-stop',
          partialSteps: stepCount,
        })
      },
    })

    for await (const part of result.fullStream) {
      if (signal.aborted) {
        break
      }

      if (part.type === 'start-step') {
        await beginStep()
        continue
      }

      if (part.type === 'finish-step') {
        await finishStep()
        continue
      }

      if (part.type === 'reasoning-delta') {
        await ensureStepOpen()
        assistantReasoning += part.text
        onEvent({
          type: 'reasoning-delta',
          delta: part.text,
          messageId: assistantId,
        })
        continue
      }

      if (part.type === 'text-delta') {
        if (stepOpen) {
          currentStepText += part.text
          onEvent({
            type: 'text-delta',
            delta: part.text,
            messageId: assistantId,
            stepId: currentStepId,
          })
        } else {
          trailingText += part.text
          onEvent({
            type: 'text-delta',
            delta: part.text,
            messageId: assistantId,
          })
        }
        continue
      }

      if (part.type === 'tool-call') {
        await ensureStepOpen()
        await emitToolStart(part.toolCallId, part.toolName, part.input)
        continue
      }

      if (part.type === 'tool-result') {
        consecutiveToolErrors = 0
        await emitToolResult(
          part.toolCallId,
          part.toolName,
          part.output,
          false,
          part.input,
        )
        continue
      }

      if (part.type === 'tool-error') {
        const message = enrichToolError(resolveToolErrorMessage(part.error))
        consecutiveToolErrors += 1
        await ensureStepOpen()
        await emitToolStart(part.toolCallId, part.toolName, part.input)
        await emitToolResult(
          part.toolCallId,
          part.toolName,
          { error: message },
          true,
          part.input,
        )
        if (consecutiveToolErrors >= MAX_CONSECUTIVE_TOOL_ERRORS) {
          streamError = new Error(
            `Too many consecutive tool failures (${MAX_CONSECUTIVE_TOOL_ERRORS}). Last error: ${message}`,
          )
          break
        }
        continue
      }

      if (part.type === 'error') {
        streamError = resolveStreamError(part.error)
      }
    }

    if (stepOpen && !signal.aborted) {
      await finishStep()
    }

    if (!trailingText && !signal.aborted && !streamError) {
      try {
        const finalText = await result.text
        if (finalText) {
          trailingText = finalText
          onEvent({ type: 'text-delta', delta: finalText })
        }
      } catch (error) {
        streamError = resolveStreamError(error)
      }
    }

    if (captureTurnMessages && hasRunningSubagentsForChat(chatId)) {
      const responseMessages = await result.responseMessages
      setTurnResponseMessages(chatId, responseMessages)
    }

    if (streamError && !signal.aborted) {
      throw streamError
    }

    if (!signal.aborted && (trailingText || assistantReasoning)) {
      await persistLine(projectSlug, chatId, {
        id: assistantId,
        role: 'assistant',
        parts: [
          ...(assistantReasoning
            ? [{ type: 'reasoning', text: assistantReasoning }]
            : []),
          ...(trailingText ? [{ type: 'text', text: trailingText }] : []),
        ],
        createdAt: nowIso(),
      })
    }
  } catch (error) {
    if (!signal.aborted) {
      onEvent({
        type: 'turn-aborted',
        reason: 'error',
        partialSteps: stepCount,
      })
      throw error
    }
  } finally {
    rejectAllPending()
    rejectAllPendingQuestions()
    setAgentShellEventEmitter(null)
    onEvent({
      type: 'chat-status-changed',
      projectSlug,
      chatId,
      status: 'idle',
    })
    await updateChatMeta(projectSlug, chatId, { status: 'idle' })
  }
}

export default async (input: OrchestratorInput): Promise<void> => {
  const {
    projectSlug,
    chatId,
    messages,
    userText,
    skipUserPersist = false,
    assistantId: inputAssistantId,
    ...streamInput
  } = input

  const existingUser = [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === 'user' &&
        message.parts.some(
          (part) => part.type === 'text' && part.text === userText,
        ),
    )

  const userLine = {
    id: existingUser?.id ?? crypto.randomUUID(),
    role: 'user' as const,
    parts: [{ type: 'text', text: userText }],
    createdAt: nowIso(),
  }

  if (!skipUserPersist) {
    await persistLine(projectSlug, chatId, userLine)
  }

  const isFirstUserMessage =
    messages.filter((message) => message.role === 'user').length === 1

  const emitTitleChange = (title: string): void => {
    input.onEvent({
      type: 'chat-meta-changed',
      projectSlug,
      chatId,
      patch: { title },
    })
  }

  if (isFirstUserMessage) {
    const fallbackTitle = deriveChatTitle(userText)
    if (fallbackTitle) {
      await updateChatMeta(projectSlug, chatId, { title: fallbackTitle })
      emitTitleChange(fallbackTitle)
    }
  }

  void runSideTask({
    projectSlug,
    chatId,
    prompt: userText,
    settings: input.settings,
  }).then((generatedTitle) => {
    if (generatedTitle && !isDefaultChatTitle(generatedTitle)) {
      emitTitleChange(generatedTitle)
    }
  })

  const modelMessages = await convertToModelMessages(messages)

  await runHarnessStream({
    ...streamInput,
    projectSlug,
    chatId,
    messages,
    modelMessages,
    assistantId: inputAssistantId ?? crypto.randomUUID(),
    captureTurnMessages: true,
  })
}

export const resumeOrchestrator = async (
  input: ResumeOrchestratorInput,
): Promise<void> => {
  const {
    projectSlug,
    chatId,
    messages,
    toolCallId,
    completedResult,
    assistantId: inputAssistantId,
    onEvent,
    ...streamInput
  } = input

  const turnMessages = getTurnResponseMessages(chatId)
  if (!turnMessages) {
    throw new Error('No pending subagent turn to resume')
  }

  onEvent({
    type: 'tool-result',
    toolCallId,
    result: completedResult,
    isError: false,
  })
  await persistToolRun(
    projectSlug,
    chatId,
    toolCallId,
    'spawn_subagent',
    'done',
    '',
    { agentName: completedResult.name, blocking: false },
    completedResult,
  )

  const patchedTurnMessages = patchSubagentToolResult(
    turnMessages,
    toolCallId,
    completedResult,
  )
  const baseMessages = await convertToModelMessages(messages)
  const modelMessages = [...baseMessages, ...patchedTurnMessages]

  clearTurnResponseMessages(chatId)

  await runHarnessStream({
    ...streamInput,
    projectSlug,
    chatId,
    messages,
    modelMessages,
    onEvent,
    assistantId: inputAssistantId ?? crypto.randomUUID(),
    captureTurnMessages: false,
  })
}

export type HarnessStatus = ChatStatus

export const mapMetaStatusToChatStatus = (
  metaStatus: 'idle' | 'running',
  isSubmitting: boolean,
): HarnessStatus => {
  if (isSubmitting) {
    return 'submitted'
  }
  if (metaStatus === 'running') {
    return 'streaming'
  }
  return 'ready'
}
