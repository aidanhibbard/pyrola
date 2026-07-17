import { generateText } from 'ai'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import createModel from '@/services/providers/create-model'
import { updateChatMeta } from '@/services/pyrola/pyrola-tauri'
import { refreshFleetSidebar } from '@/composables/use-fleet-sidebar'

export type ChatTitleTaskInput = {
  projectSlug: string
  chatId: string
  prompt: string
  providerId: string
  settings: PyrolaSettings
}

export default async (input: ChatTitleTaskInput): Promise<string | null> => {
  try {
    if (input.settings['chat.autoTitle'] === false) {
      return null
    }

    const modelId =
      input.settings['chat.autoTitleModel'] ??
      input.settings['agent.defaultModel'] ??
      'gpt-4o-mini'

    const model = await createModel({
      providerId: input.providerId,
      modelId,
      settings: input.settings,
    })

    const result = await generateText({
      model,
      maxOutputTokens: 256,
      prompt: `Generate a short chat title (max 6 words, no quotes) for this user message:\n\n${input.prompt}`,
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
