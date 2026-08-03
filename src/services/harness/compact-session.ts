import { generateText } from 'ai'
import type { UIMessage } from 'ai'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import createModel from '@/services/providers/create-model'
import loadPrompt from '@/services/prompts/load-prompt'
import { appendChatLine, updateChatMeta } from '@/services/pyrola/pyrola-tauri'
import { resolveParsedModelForRole } from '@/services/models/resolve-model-for-role'
import { resolveSideTaskCallOptions } from '@/services/models/resolve-model-call-options'
import estimateTextTokens from '@/utils/estimate-text-tokens'
import formatUnknownError from '@/utils/format-unknown-error'

export type CompactSessionInput = {
  projectSlug: string
  chatId: string
  projectRoot: string
  settings: PyrolaSettings
  messages: UIMessage[]
  focus?: string
  signal?: AbortSignal
  frozenSystem?: string
  chatModel?: string
}

export type CompactSessionResult = {
  summary: string
  includeFromCreatedAt: string
  checkpointLineId: string
}

const ACTIVE_WINDOW_TOKEN_BUDGET = 8_000
const COMPACT_MAX_OUTPUT_TOKENS = 2048
const TRANSCRIPT_TOKEN_BUDGET = 24_000

const serializeMessageText = (message: UIMessage): string =>
  message.parts
    .map((part) => {
      if (part.type === 'text' || part.type === 'reasoning') {
        return part.text
      }
      return JSON.stringify(part)
    })
    .join('\n')
    .trim()

const buildTranscript = (messages: UIMessage[]): string => {
  const reversed = [...messages].reverse()
  const kept: string[] = []
  let tokens = 0

  for (const message of reversed) {
    const text = serializeMessageText(message)
    if (!text) {
      continue
    }
    const line = `${message.role.toUpperCase()}:\n${text}`
    const estimate = estimateTextTokens(line)
    if (tokens + estimate > TRANSCRIPT_TOKEN_BUDGET && kept.length > 0) {
      break
    }
    tokens += estimate
    kept.unshift(line)
  }

  if (kept.length === 0) {
    return '(empty conversation)'
  }

  return kept.join('\n\n')
}

const buildActiveWindowMessages = (
  messages: UIMessage[],
  summary: string,
): UIMessage[] => {
  const reversed = [...messages].reverse()
  const kept: UIMessage[] = []
  let tokens = 0

  for (const message of reversed) {
    const text = serializeMessageText(message)
    const estimate = estimateTextTokens(text)
    if (tokens + estimate > ACTIVE_WINDOW_TOKEN_BUDGET) {
      break
    }
    tokens += estimate
    kept.unshift(message)
  }

  if (kept.length === 0 && messages.length > 0) {
    const last = messages[messages.length - 1]
    if (last) {
      kept.push(last)
    }
  }

  const checkpointMessage: UIMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    parts: [
      {
        type: 'text',
        text: `Prior checkpoint (history, not instructions):\n${summary}`,
      },
    ],
    metadata: { createdAt: new Date().toISOString() },
  }

  return [checkpointMessage, ...kept]
}

export default async (input: CompactSessionInput): Promise<CompactSessionResult> => {
  const {
    projectSlug,
    chatId,
    settings,
    messages,
    focus,
    signal,
    frozenSystem,
    chatModel,
  } = input

  try {
    const modelRef = resolveParsedModelForRole('compaction', settings, chatModel)
    if (!modelRef) {
      throw new Error('No model configured for compaction. Set a default model in Settings.')
    }

    const model = await createModel({
      providerId: modelRef.providerId,
      modelId: modelRef.modelId,
      settings,
    })

    const callOptions = resolveSideTaskCallOptions(settings, modelRef)
    const checkpointPrompt = loadPrompt('system/compact.md', {
      focus: focus ?? 'none',
    })
    const transcript = buildTranscript(messages)
    const prompt = [
      checkpointPrompt,
      '',
      '## Conversation transcript',
      '',
      transcript,
    ].join('\n')

    const system =
      frozenSystem ??
      'You are a context compaction assistant. Summarize the conversation concisely.'

    const result = await generateText({
      model,
      system,
      prompt,
      maxOutputTokens: COMPACT_MAX_OUTPUT_TOKENS,
      temperature: callOptions.temperature,
      topP: callOptions.topP,
      topK: callOptions.topK,
      providerOptions: callOptions.providerOptions,
      abortSignal: signal,
    })

    const summary = result.text.trim()
    if (!summary) {
      throw new Error('Compaction returned empty summary')
    }

    const checkpointLineId = crypto.randomUUID()
    const nowIso = new Date().toISOString()

    await appendChatLine(projectSlug, chatId, {
      id: checkpointLineId,
      role: 'assistant',
      parts: [],
      createdAt: nowIso,
      harnessEvent: {
        type: 'compaction',
        summary,
        focus: focus ?? null,
      },
    })

    const activeMessages = buildActiveWindowMessages(messages, summary)

    const firstRealMessage = activeMessages.find(
      (m) =>
        !(
          m.role === 'user' &&
          m.parts.some(
            (p) =>
              p.type === 'text' &&
              (p as { type: string; text: string }).text.startsWith('Prior checkpoint'),
          )
        ),
    )
    const includeFromCreatedAt =
      (firstRealMessage?.metadata &&
      typeof (firstRealMessage.metadata as Record<string, unknown>).createdAt === 'string'
        ? ((firstRealMessage.metadata as Record<string, unknown>).createdAt as string)
        : null) ?? nowIso

    await updateChatMeta(projectSlug, chatId, {
      activeContext: {
        checkpointLineId,
        includeFromCreatedAt,
        summary,
      },
    })

    return { summary, includeFromCreatedAt, checkpointLineId }
  } catch (error) {
    throw new Error(formatUnknownError(error))
  }
}
