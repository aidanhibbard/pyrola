import type { ChatStatus, ModelMessage, UIMessage } from 'ai'
import { convertToModelMessages, isLoopFinished, smoothStream, stepCountIs, streamText } from 'ai'
import type { HarnessEvent, TodoItem } from '@/types/harness/harness-event'
import parseTodoUpdate from '@/services/harness/parse-todo-update'
import type { ChatArtifact } from '@/types/chat/chat-artifact'
import type { ContextMention } from '@/types/harness/context-mention'
import type { MentionHighlight } from '@/types/chat/mention-highlight'
import { mentionHighlightSchema } from '@/schemas/mention-highlight'
import type { ChatTimelineItem } from '@/types/chat/chat-timeline-item'
import type { PyrolaChatMode, PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import type { ReasoningLevel } from '@/types/models/reasoning-level'
import { isReasoningLevel } from '@/types/models/reasoning-level'
import type { SubagentResult } from '@/types/harness/subagent-record'
import type { PermissionCapabilityKey, PermissionLevel } from '@/types/harness/permission'
import type { SystemPromptParts } from '@/services/context/system-prompt-parts'
import createModel from '@/services/providers/create-model'
import captureBillableUsage from '@/services/billing/capture-billable-usage'
import {
  appendChatLine,
  readChatMeta,
  updateChatMeta,
} from '@/services/pyrola/pyrola-tauri'
import assembleSystemPromptParts, {
  formatMentionsAsText,
  joinSystemPromptParts,
} from '@/services/context/system-prompt-parts'
import {
  buildPrefixSnapshot,
  getFrozenPrefix,
  partsFromFrozenPrefix,
} from '@/services/harness/prefix-contract'
import countContextBudget from '@/services/context/count-context-budget'
import filterMessagesForActiveContext from '@/services/context/filter-messages-for-active-context'
import buildTools from '@/services/harness/build-tools'
import { MODE_TOOL_ALLOWLIST } from '@/services/harness/mode-allowlists'
import {
  beginPlanExecutionTurn,
  getPlanExecutionSession,
  hydratePlanExecutionSession,
  PLAN_GO_BLOCKED_TOOLS,
  PLAN_GO_EXECUTE_GATE_TOOLS,
} from '@/services/harness/plan-execution-session'
import { rejectPendingForChat } from '@/services/harness/approval-gate'
import { rejectPendingQuestionsForChat } from '@/services/harness/question-gate'
import { rejectPendingMcpAuthForChat } from '@/services/mcp/mcp-auth-gate'
import runSideTask from '@/services/harness/run-side-task'
import enrichToolError from '@/services/harness/enrich-tool-error'
import deriveToolArtifact from '@/services/harness/derive-tool-artifact'
import { fileDiffListSchema } from '@/schemas/file-diff'
import type { FileDiff } from '@/types/harness/file-diff'
import { isDefaultChatTitle } from '@/utils/derive-chat-title'
import {
  killShellsForChat,
  setAgentShellEventEmitter,
} from '@/services/harness/agent-shell-registry'
import {
  abort as abortSubagentsForChat,
  clearPendingBackgroundResume,
  clearTurnResponseMessages,
  getTurnResponseMessages,
  hasPendingBackgroundResume,
  hasRunningSubagentsForChat,
  setTurnResponseMessages,
} from '@/services/harness/subagent-registry'
import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  resolveModelCallOptions,
} from '@/services/models/resolve-model-call-options'
import {
  pickResolvedReasoning,
  resolveCatalogReasoning,
  resolveReasoningForRole,
} from '@/services/models/resolve-reasoning-for-call'
import resolveModelRefForCall from '@/services/models/resolve-model-ref-for-call'
import { toast } from 'vue-sonner'
import truncateToolResult from '@/utils/truncate-tool-result'
import resolveModelVision from '@/services/harness/resolve-model-vision'
import dropTrailingAssistantMessages from '@/utils/drop-trailing-assistant-messages'
import prepareMessagesForModelVision from '@/utils/prepare-messages-for-model-vision'

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
  timeline?: ChatTimelineItem[]
  userText: string
  mentions: ContextMention[]
  signal: AbortSignal
  onEvent: (event: HarnessEvent) => void
  assistantId?: string
  skipUserPersist?: boolean
  standalone?: boolean
  permissionLevel?: PermissionLevel
  reasoning?: ReasoningLevel
  persistPermission?: (
    capability: PermissionCapabilityKey,
    verdict: 'allow' | 'deny',
    scope: 'workspace' | 'always',
  ) => Promise<void>
}

export type ResumeOrchestratorInput = Omit<
  OrchestratorInput,
  'userText' | 'skipUserPersist'
> & {
  completedResults: Array<{ toolCallId: string; result: SubagentResult }>
  skipUserPersist: true
}
const MAX_OUTPUT_TOKENS = DEFAULT_MAX_OUTPUT_TOKENS

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
    | Extract<HarnessEvent, { type: 'subagent-result' }>
    | Extract<HarnessEvent, { type: 'subagent-event' }>,
): Promise<void> => {
  const lineId =
    event.type === 'subagent-start'
      ? event.subagentId
      : event.type === 'subagent-result'
        ? `${event.subagentId}-result`
        : `${event.subagentId}-event-${crypto.randomUUID()}`
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
  options?: { awaitingPlanGo?: boolean },
): Partial<ReturnType<typeof buildTools>> => {
  const allow = new Set(MODE_TOOL_ALLOWLIST[mode])
  const entries = Object.entries(tools).filter(([name]) => {
    if (!allow.has(name)) {
      return false
    }
    if (
      options?.awaitingPlanGo &&
      PLAN_GO_BLOCKED_TOOLS.has(name) &&
      !PLAN_GO_EXECUTE_GATE_TOOLS.has(name)
    ) {
      return false
    }
    return true
  })
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

const injectContextIntoLastUserMessage = (
  modelMessages: ModelMessage[],
  contextText: string,
): ModelMessage[] => {
  if (!contextText.trim()) {
    return modelMessages
  }
  let lastUserIdx = -1
  for (let i = modelMessages.length - 1; i >= 0; i--) {
    const candidate = modelMessages[i]
    if (candidate?.role === 'user') {
      lastUserIdx = i
      break
    }
  }
  if (lastUserIdx === -1) {
    return modelMessages
  }
  const msg = modelMessages[lastUserIdx]
  if (!msg || msg.role !== 'user') {
    return modelMessages
  }
  const result = [...modelMessages]
  if (typeof msg.content === 'string') {
    result[lastUserIdx] = {
      ...msg,
      role: 'user',
      content: `${contextText}\n\n${msg.content}`,
    }
    return result
  }
  if (Array.isArray(msg.content)) {
    const parts = [...msg.content]
    const textIdx = parts.findIndex((part) => part.type === 'text')
    if (textIdx >= 0) {
      const existing = parts[textIdx]
      if (existing?.type === 'text') {
        parts[textIdx] = {
          ...existing,
          text: `${contextText}\n\n${existing.text ?? ''}`,
        }
        result[lastUserIdx] = { ...msg, role: 'user', content: parts }
      }
    } else {
      result[lastUserIdx] = {
        ...msg,
        role: 'user',
        content: [{ type: 'text', text: contextText }, ...parts],
      }
    }
    return result
  }
  return modelMessages
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
        const truncatedSummary = truncateToolResult(completedResult.summary)
        const summary =
          typeof truncatedSummary === 'string'
            ? truncatedSummary
            : completedResult.summary
        return {
          ...part,
          output: {
            type: 'json' as const,
            value: {
              subagentId: completedResult.subagentId,
              name: completedResult.name,
              summary,
            },
          },
        }
      }),
    }
  })

const patchSubagentToolResults = (
  messages: ModelMessage[],
  completedResults: Array<{ toolCallId: string; result: SubagentResult }>,
): ModelMessage[] =>
  completedResults.reduce(
    (next, item) => patchSubagentToolResult(next, item.toolCallId, item.result),
    messages,
  )

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
  timeline?: ChatTimelineItem[]
  modelMessages: ModelMessage[]
  userMessageId: string
  signal: AbortSignal
  onEvent: (event: HarnessEvent) => void
  assistantId: string
  captureTurnMessages: boolean
  standalone?: boolean
  permissionLevel?: PermissionLevel
  reasoning?: ReasoningLevel
  activeContext?: {
    summary?: string
    includeFromCreatedAt?: string
  } | null
  persistPermission?: (
    capability: PermissionCapabilityKey,
    verdict: 'allow' | 'deny',
    scope: 'workspace' | 'always',
  ) => Promise<void>
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
    timeline,
    modelMessages,
    userMessageId,
    signal,
    onEvent,
    assistantId,
    captureTurnMessages,
  } = input

  setAgentShellEventEmitter(chatId, onEvent)

  onEvent({
    type: 'chat-status-changed',
    projectSlug,
    chatId,
    status: 'running',
  })
  await updateChatMeta(projectSlug, chatId, { status: 'running', attention: null })

  const callModel = resolveModelRefForCall(settings, { providerId, modelId })

  const [existingMeta, model] = await Promise.all([
    readChatMeta(projectSlug, chatId).catch(() => null),
    createModel({
      providerId: callModel.createRef.providerId,
      modelId: callModel.createRef.modelId,
      settings,
    }),
  ])

  const planSession = beginPlanExecutionTurn(projectSlug, chatId)
  if (existingMeta) {
    hydratePlanExecutionSession(projectSlug, chatId, {
      awaitingPlanGo: existingMeta.awaitingPlanGo ?? null,
      subagentModel: existingMeta.subagentModel ?? null,
      subagentReasoning: isReasoningLevel(existingMeta.subagentReasoning)
        ? existingMeta.subagentReasoning
        : null,
    })
  }

  const supportsVision = await resolveModelVision({
    model,
    providerId: callModel.createRef.providerId,
    modelId: callModel.createRef.modelId,
    settings,
  })

  const frozenSnapshot = existingMeta ? getFrozenPrefix(existingMeta) : null

  let system: string
  let parts: SystemPromptParts

  if (frozenSnapshot) {
    system = frozenSnapshot.systemString
    parts = partsFromFrozenPrefix(frozenSnapshot)
  } else {
    const freshParts = await assembleSystemPromptParts({
      mode,
      projectName,
      projectRoot,
      mentions: [],
      agentCatalog: [],
      standalone: input.standalone,
    })
    // Mentions are injected into the last user message, not the frozen prefix.
    const prefixParts: SystemPromptParts = { ...freshParts, mentions: '' }
    system = joinSystemPromptParts(prefixParts)
    parts = prefixParts

    const snapshot = buildPrefixSnapshot({
      systemString: system,
      toolSchemasJson: freshParts.tools,
      mcpCatalogSnapshot: freshParts.mcp,
      rulesBodies: freshParts.rules,
      parts: prefixParts,
    })
    updateChatMeta(projectSlug, chatId, {
      prefixSnapshot: snapshot as unknown as Record<string, unknown>,
    }).catch(() => {})
    onEvent({
      type: 'chat-meta-changed',
      projectSlug,
      chatId,
      patch: { prefixSnapshot: snapshot },
    })
  }

  const mentionsText = formatMentionsAsText(mentions)
  const finalModelMessages = mentionsText
    ? injectContextIntoLastUserMessage(modelMessages, `Context:\n${mentionsText}`)
    : modelMessages

  const budget = await countContextBudget({
    modelId,
    providerId,
    settings,
    mode,
    projectName,
    projectRoot,
    mentions,
    messages,
    timeline,
    standalone: input.standalone,
    parts,
    frozenSnapshot,
    activeContext: input.activeContext,
  })
  onEvent({
    type: 'context-budget',
    modelId,
    used: budget.used,
    promptUsed: budget.promptUsed,
    limit: budget.limit,
    reservedOutput: budget.reservedOutput,
    safetyBuffer: budget.safetyBuffer,
    free: budget.free,
    buckets: budget.buckets,
  })

  const callOptions = resolveModelCallOptions(settings, callModel.optionRef, {
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    reasoning: pickResolvedReasoning([
      input.reasoning,
      resolveCatalogReasoning(settings, callModel.optionRef),
      resolveReasoningForRole(mode, settings),
    ]),
  })

  const handleHarnessEvent = (event: HarnessEvent): void => {
    if (
      event.type === 'subagent-start' ||
      event.type === 'subagent-result' ||
      event.type === 'subagent-event'
    ) {
      persistSubagentHarnessEvent(projectSlug, chatId, event).catch((error) => {
        toast.error('Failed to save subagent event', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    }
    if (event.type === 'pending-subagent') {
      persistPendingSubagent(projectSlug, chatId, event).catch((error) => {
        toast.error('Failed to save pending subagent', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    }
    onEvent(event)
  }

  const sessionAllows = new Set<string>()
  const sessionDenies = new Set<string>()

  const allTools = buildTools({
    projectRoot,
    projectSlug,
    chatId,
    userMessageId,
    // AgentTurn.id is passed as assistantId from use-agent-harness.
    turnId: assistantId,
    settings,
    permissionLevel: input.permissionLevel ?? settings['agent.permissionLevel'] ?? 'allowlist',
    sessionAllows,
    sessionDenies,
    sandboxEnabled: settings['agent.sandbox.enabled'] ?? false,
    supportsVision,
    onPendingApproval: (entry) => {
      onEvent({
        type: 'tool-pending-approval',
        toolCallId: entry.toolCallId,
        name: entry.name,
        kind: entry.kind,
        title: entry.title,
        detail: entry.detail,
        unsandboxed: entry.unsandboxed,
        allowedScopes: entry.allowedScopes,
        diff: entry.diff ?? [],
      })
    },
    persistPermission: input.persistPermission,
    onHarnessEvent: handleHarnessEvent,
    signal,
  })
  const tools = filterToolsForMode(mode, allTools, {
    awaitingPlanGo: Boolean(planSession.awaitingPlanGo),
  })

  let trailingText = ''
  let assistantReasoning = ''
  let stepCount = 0
  let streamError: Error | null = null
  let currentStepId = ''
  let currentStepText = ''
  let collectedStepText = ''
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
      collectedStepText = collectedStepText
        ? `${collectedStepText}\n\n${currentStepText}`
        : currentStepText
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
    const truncated = isError ? result : truncateToolResult(result)
    const artifact = deriveToolArtifact(name, truncated, args, isError)
    const diffs = isError ? undefined : deriveToolDiffs(truncated)
    onEvent({
      type: 'tool-result',
      toolCallId,
      result: truncated,
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
      truncated,
      artifact,
      diffs,
    )
    if (!isError) {
      const todos = parseTodoUpdate(name, truncated)
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
      messages: finalModelMessages,
      tools,
      maxOutputTokens: callOptions.maxOutputTokens,
      temperature: callOptions.temperature,
      topP: callOptions.topP,
      topK: callOptions.topK,
      frequencyPenalty: callOptions.frequencyPenalty,
      presencePenalty: callOptions.presencePenalty,
      seed: callOptions.seed,
      reasoning: callOptions.reasoning,
      providerOptions: callOptions.providerOptions,
      experimental_transform: smoothStream({ chunking: 'word' }),
      stopWhen: [
        isLoopFinished(),
        stepCountIs(settings['agent.maxStepsPerTurn'] ?? 40),
        () => getPlanExecutionSession(projectSlug, chatId).createdPlanThisTurn,
      ],
      abortSignal: signal,
      onAbort: async () => {
        rejectPendingForChat(chatId)
        rejectPendingQuestionsForChat(chatId)
        rejectPendingMcpAuthForChat(chatId)
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
        const usage = part.usage
        const inputTokens = usage?.inputTokens ?? 0
        const cacheReadTokens = usage?.inputTokenDetails?.cacheReadTokens ?? 0
        const cacheWriteTokens = usage?.inputTokenDetails?.cacheWriteTokens ?? 0
        const outputTokens = usage?.outputTokens ?? 0
        // Last-step billing stats for the footer only. Ring fill uses the local
        // budget estimate from context-budget, not these provider counts.
        const promptTokens = inputTokens > 0
          ? inputTokens
          : cacheReadTokens + cacheWriteTokens
        onEvent({
          type: 'context-usage',
          modelId,
          promptTokens,
          inputTokens,
          outputTokens,
          cacheReadTokens,
          cacheWriteTokens,
        })
        await captureBillableUsage({
          projectSlug,
          chatId,
          turnId: assistantId,
          source: 'main',
          providerId: callModel.createRef.providerId,
          modelId: callModel.createRef.modelId,
          usage,
          providerMetadata: part.providerMetadata,
          responseId: part.response?.id,
          settings,
          onEvent,
        })
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
          stepId: currentStepId,
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

      if (part.type === 'tool-input-start') {
        await ensureStepOpen()
        onEvent({
          type: 'tool-input-start',
          toolCallId: part.id,
          name: part.toolName,
        })
        continue
      }

      if (part.type === 'tool-call') {
        await ensureStepOpen()
        await emitToolStart(part.toolCallId, part.toolName, part.input)
        continue
      }

      if (part.type === 'tool-result') {
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
        await ensureStepOpen()
        await emitToolStart(part.toolCallId, part.toolName, part.input)
        await emitToolResult(
          part.toolCallId,
          part.toolName,
          { error: message },
          true,
          part.input,
        )
        continue
      }

      if (part.type === 'error') {
        streamError = resolveStreamError(part.error)
      }
    }

    if (stepOpen && !signal.aborted) {
      await finishStep()
    }

    // Prefer text already streamed into steps. Only fall back to result.text when
    // nothing was collected — and never re-emit it as a live delta (that duplicates
    // step text in the timeline UI).
    if (!trailingText && !signal.aborted && !streamError) {
      if (collectedStepText.trim()) {
        trailingText = collectedStepText
      } else {
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
    }

    if (captureTurnMessages && hasPendingBackgroundResume(chatId)) {
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
    rejectPendingForChat(chatId)
    rejectPendingQuestionsForChat(chatId)
    rejectPendingMcpAuthForChat(chatId)
    setAgentShellEventEmitter(chatId, null)
    // Parent turn is done locally (idle) so resume can flush, but keep the
    // sidebar "running" while background subagents are still working.
    const waitingOnBackground = hasRunningSubagentsForChat(chatId)
    onEvent({
      type: 'chat-status-changed',
      projectSlug,
      chatId,
      status: 'idle',
    })
    if (waitingOnBackground) {
      await updateChatMeta(projectSlug, chatId, { status: 'running' })
      onEvent({
        type: 'chat-meta-changed',
        projectSlug,
        chatId,
        patch: { status: 'running' },
      })
    } else {
      await updateChatMeta(projectSlug, chatId, { status: 'idle' })
    }
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

  const existingUserMeta =
    existingUser?.metadata && typeof existingUser.metadata === 'object'
      ? (existingUser.metadata as Record<string, unknown>)
      : null

  const mentionHighlightsParsed = mentionHighlightSchema
    .array()
    .safeParse(existingUserMeta?.mentionHighlights)
  const mentionHighlights: MentionHighlight[] | undefined =
    mentionHighlightsParsed.success && mentionHighlightsParsed.data.length > 0
      ? mentionHighlightsParsed.data
      : undefined

  const userLine = {
    id: existingUser?.id ?? crypto.randomUUID(),
    role: 'user' as const,
    parts: existingUser?.parts ?? [{ type: 'text' as const, text: userText }],
    createdAt: nowIso(),
    model:
      typeof existingUserMeta?.model === 'string'
        ? existingUserMeta.model
        : `${input.providerId}::${input.modelId}`,
    ...(mentionHighlights ? { mentionHighlights } : {}),
  }

  if (!skipUserPersist) {
    await persistLine(projectSlug, chatId, userLine)
  }

  const isFirstUserMessage =
    messages.filter((message) => message.role === 'user').length === 1

  const assistantId = inputAssistantId ?? crypto.randomUUID()

  const emitTitleChange = (title: string): void => {
    input.onEvent({
      type: 'chat-meta-changed',
      projectSlug,
      chatId,
      patch: { title },
    })
  }

  if (isFirstUserMessage) {
    // Keep the short "New Agent" placeholder while naming runs. Never copy the
    // user prompt into the sidebar title (including sync fallbacks).
    runSideTask({
      projectSlug,
      chatId,
      prompt: userText,
      settings: input.settings,
      fallbackProviderId: input.providerId,
      fallbackModelId: input.modelId,
      turnId: assistantId,
      onEvent: input.onEvent,
    }).then((generatedTitle) => {
      if (generatedTitle && !isDefaultChatTitle(generatedTitle)) {
        emitTitleChange(generatedTitle)
      }
    })
  }

  const activeContextMeta = await readChatMeta(projectSlug, chatId).catch(() => null)
  const activeContext = activeContextMeta?.activeContext
  const { messages: contextMessages, checkpointText } = filterMessagesForActiveContext(
    messages,
    activeContext,
  )
  const visionModel = await createModel({
    providerId: input.providerId,
    modelId: input.modelId,
    settings: input.settings,
  })
  const supportsVision = await resolveModelVision({
    model: visionModel,
    providerId: input.providerId,
    modelId: input.modelId,
    settings: input.settings,
  })
  const recentModelMessages = await convertToModelMessages(
    prepareMessagesForModelVision(contextMessages, supportsVision),
  )
  const effectiveModelMessages: ModelMessage[] = checkpointText
    ? [
        {
          role: 'user',
          content: checkpointText,
        },
        ...recentModelMessages,
      ]
    : recentModelMessages

  await runHarnessStream({
    ...streamInput,
    projectSlug,
    chatId,
    messages,
    modelMessages: effectiveModelMessages,
    userMessageId: userLine.id,
    assistantId,
    captureTurnMessages: true,
    standalone: input.standalone,
    permissionLevel: input.permissionLevel,
    persistPermission: input.persistPermission,
    activeContext,
  })
}

export const resumeOrchestrator = async (
  input: ResumeOrchestratorInput,
): Promise<void> => {
  const {
    projectSlug,
    chatId,
    messages,
    completedResults,
    assistantId: inputAssistantId,
    onEvent,
    ...streamInput
  } = input

  if (completedResults.length === 0) {
    throw new Error('No completed subagent results to resume')
  }

  const turnMessages = getTurnResponseMessages(chatId)
  if (!turnMessages) {
    throw new Error('No pending subagent turn to resume')
  }

  for (const item of completedResults) {
    onEvent({
      type: 'tool-result',
      toolCallId: item.toolCallId,
      result: item.result,
      isError: false,
    })
    await persistToolRun(
      projectSlug,
      chatId,
      item.toolCallId,
      'spawn_subagent',
      'done',
      '',
      { agentName: item.result.name, blocking: false },
      item.result,
    )
  }

  const patchedTurnMessages = patchSubagentToolResults(
    turnMessages,
    completedResults,
  )
  const activeContextMeta = await readChatMeta(projectSlug, chatId).catch(() => null)
  const activeContext = activeContextMeta?.activeContext
  const { messages: contextMessages, checkpointText } = filterMessagesForActiveContext(
    messages,
    activeContext,
  )
  const priorMessages = dropTrailingAssistantMessages(contextMessages)
  const visionModel = await createModel({
    providerId: input.providerId,
    modelId: input.modelId,
    settings: input.settings,
  })
  const supportsVision = await resolveModelVision({
    model: visionModel,
    providerId: input.providerId,
    modelId: input.modelId,
    settings: input.settings,
  })
  const recentModelMessages = await convertToModelMessages(
    prepareMessagesForModelVision(priorMessages, supportsVision),
  )
  const baseMessages: ModelMessage[] = checkpointText
    ? [{ role: 'user', content: checkpointText }, ...recentModelMessages]
    : recentModelMessages
  const wakeNudge: ModelMessage = {
    role: 'user',
    content:
      'All background subagents finished. Their completed summaries are in the spawn_subagent tool results above. Answer the user now using those results. Do not say the subagents are still running.',
  }
  const modelMessages = [...baseMessages, ...patchedTurnMessages, wakeNudge]

  clearTurnResponseMessages(chatId)
  clearPendingBackgroundResume(chatId)

  const lastUser = [...messages].reverse().find((message) => message.role === 'user')
  const userMessageId = lastUser?.id
  if (!userMessageId) {
    throw new Error('Cannot resume harness without a user message id for file checkpoints')
  }

  await runHarnessStream({
    ...streamInput,
    mentions: [],
    projectSlug,
    chatId,
    messages,
    modelMessages,
    userMessageId,
    onEvent,
    assistantId: inputAssistantId ?? crypto.randomUUID(),
    captureTurnMessages: false,
    permissionLevel: input.permissionLevel,
    persistPermission: input.persistPermission,
    activeContext,
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
