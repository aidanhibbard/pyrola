import type { ModelRef } from '@/types/models/model-ref'

/**
 * Anthropic native models that accept providerOptions.anthropic.speed = 'fast'.
 * Docs: https://docs.anthropic.com/en/docs/build-with-claude/effort
 * Opus 4-7 errors; Opus 4-6 silently runs standard; Sonnet/Haiku unsupported.
 */
const isAnthropicNativeFastModel = (modelId: string): boolean => {
  const id = modelId
    .trim()
    .toLowerCase()
    .replace(/-\d{8}$/, '')
    .replace(/-\d{4}-\d{2}-\d{2}$/, '')
  return id.startsWith('claude-opus-5') || id.startsWith('claude-opus-4-8')
}

/**
 * Whether Fast is available for a catalog ModelRef after variant collapse.
 * Prefers live/sibling `supportsFast`, then Anthropic native id rules only.
 */
export const resolveSupportsFast = (ref: ModelRef): boolean => {
  if (ref.supportsFast === true) {
    return true
  }
  if (ref.providerId === 'anthropic') {
    return isAnthropicNativeFastModel(ref.modelId)
  }
  return false
}

export default resolveSupportsFast
