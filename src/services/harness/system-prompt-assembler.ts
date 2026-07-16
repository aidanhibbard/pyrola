import assembleSystemPromptParts, {
  joinSystemPromptParts,
  type SystemPromptInput,
} from '@/services/context/system-prompt-parts'

export type { SystemPromptInput }

export default async (input: SystemPromptInput): Promise<string> => {
  const parts = await assembleSystemPromptParts(input)
  return joinSystemPromptParts(parts)
}
