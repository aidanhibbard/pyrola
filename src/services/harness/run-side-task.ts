import { generateText } from 'ai'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import createModel from '@/services/providers/create-model'
import loadPrompt from '@/services/prompts/load-prompt'
import { updateChatMeta } from '@/services/pyrola/pyrola-tauri'
import { refreshFleetSidebar } from '@/composables/use-fleet-sidebar'
import { resolveParsedModelForRole } from '@/services/models/resolve-model-for-role'
import { resolveSideTaskCallOptions } from '@/services/models/resolve-model-call-options'
import { isDefaultChatTitle, isPromptEchoTitle } from '@/utils/derive-chat-title'

/** Cap title-model input so huge pastes are not fully re-sent for naming. */
const TITLE_PROMPT_MAX_CHARS = 2000

/** Titles are max ~6 words; keep generation cheap. */
const TITLE_MAX_OUTPUT_TOKENS = 64

export type ChatTitleTaskInput = {
  projectSlug: string
  chatId: string
  prompt: string
  settings: PyrolaSettings
  /** Used when models.title and models.default are unset (per-chat model pick). */
  fallbackProviderId?: string
  fallbackModelId?: string
}

const truncateTitlePrompt = (prompt: string): string => {
  if (prompt.length <= TITLE_PROMPT_MAX_CHARS) {
    return prompt
  }
  return prompt.slice(0, TITLE_PROMPT_MAX_CHARS)
}

const stripThinkBlocks = (text: string): string =>
  text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim()

const cleanGeneratedTitle = (raw: string): string => {
  const withoutThink = stripThinkBlocks(raw)
  const line =
    withoutThink
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .at(-1) ?? ''
  return line.replace(/^["']|["']$/g, '').slice(0, 80).trim()
}

export default async (input: ChatTitleTaskInput): Promise<string | null> => {
  try {
    if (input.settings['chat.autoTitle'] === false) {
      return null
    }

    const modelRef =
      resolveParsedModelForRole('title', input.settings) ??
      (input.fallbackProviderId && input.fallbackModelId
        ? { providerId: input.fallbackProviderId, modelId: input.fallbackModelId }
        : null)
    if (!modelRef) {
      return null
    }

    const model = await createModel({
      providerId: modelRef.providerId,
      modelId: modelRef.modelId,
      settings: input.settings,
      // Thinking models spend the whole max_tokens budget on reasoning and return
      // empty content (confirmed with local Qwen at max_tokens=64/512).
      disableThinking: true,
    })
    const callOptions = resolveSideTaskCallOptions(input.settings, modelRef)
    const maxOutputTokens = Math.min(
      callOptions.maxOutputTokens ?? TITLE_MAX_OUTPUT_TOKENS,
      TITLE_MAX_OUTPUT_TOKENS,
    )

    const result = await generateText({
      model,
      maxOutputTokens,
      temperature: callOptions.temperature ?? 0.4,
      topP: callOptions.topP,
      topK: callOptions.topK,
      frequencyPenalty: callOptions.frequencyPenalty,
      presencePenalty: callOptions.presencePenalty,
      seed: callOptions.seed,
      providerOptions: callOptions.providerOptions,
      prompt: loadPrompt('side-tasks/chat-title.md', {
        prompt: truncateTitlePrompt(input.prompt),
      }),
    })

    const title = cleanGeneratedTitle(result.text)
    if (!title || isDefaultChatTitle(title) || isPromptEchoTitle(title, input.prompt)) {
      return null
    }

    await updateChatMeta(input.projectSlug, input.chatId, { title })
    await refreshFleetSidebar()
    return title
  } catch (error) {
    console.warn('[pyrola] chat title generation failed', error)
    return null
  }
}
