import { generateText } from 'ai'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import createModel from '@/services/providers/create-model'
import loadPrompt from '@/services/prompts/load-prompt'
import { updateChatMeta } from '@/services/pyrola/pyrola-tauri'
import { refreshFleetSidebar } from '@/composables/use-fleet-sidebar'
import { resolveParsedModelForRole } from '@/services/models/resolve-model-for-role'
import { resolveSideTaskCallOptions } from '@/services/models/resolve-model-call-options'

/** Cap title-model input so huge pastes are not fully re-sent for naming. */
const TITLE_PROMPT_MAX_CHARS = 2000

/** Titles are max ~6 words; keep generation cheap. */
const TITLE_MAX_OUTPUT_TOKENS = 64

export type ChatTitleTaskInput = {
  projectSlug: string
  chatId: string
  prompt: string
  settings: PyrolaSettings
}

const truncateTitlePrompt = (prompt: string): string => {
  if (prompt.length <= TITLE_PROMPT_MAX_CHARS) {
    return prompt
  }
  return prompt.slice(0, TITLE_PROMPT_MAX_CHARS)
}

export default async (input: ChatTitleTaskInput): Promise<string | null> => {
  try {
    if (input.settings['chat.autoTitle'] === false) {
      return null
    }

    const modelRef = resolveParsedModelForRole('title', input.settings)
    if (!modelRef) {
      return null
    }

    const model = await createModel({
      providerId: modelRef.providerId,
      modelId: modelRef.modelId,
      settings: input.settings,
    })
    const callOptions = resolveSideTaskCallOptions(input.settings, modelRef)
    const maxOutputTokens = Math.min(
      callOptions.maxOutputTokens ?? TITLE_MAX_OUTPUT_TOKENS,
      TITLE_MAX_OUTPUT_TOKENS,
    )

    const result = await generateText({
      model,
      maxOutputTokens,
      temperature: callOptions.temperature,
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

    const title = result.text.trim().replace(/^["']|["']$/g, '').slice(0, 80)
    if (!title) {
      return null
    }

    await updateChatMeta(input.projectSlug, input.chatId, { title })
    await refreshFleetSidebar()
    return title
  } catch {
    // Title generation is best-effort and should not block the main agent turn.
    return null
  }
}
