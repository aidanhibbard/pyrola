import type { ModelRef } from '@/types/models/model-ref'
import usesAnthropicPromptCache from '@/services/models/uses-anthropic-prompt-cache'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
type JsonObject = { [key: string]: JsonValue }

type CallOptionsWithProvider = {
  providerOptions?: Record<string, JsonObject>
}

/** Explicit ephemeral breakpoint. AI SDK maps this to Anthropic cache_control. */
const ANTHROPIC_CACHE_CONTROL: JsonObject = { type: 'ephemeral' }

export default (options: CallOptionsWithProvider, ref: ModelRef): void => {
  if (!usesAnthropicPromptCache(ref)) {
    return
  }
  const existing = options.providerOptions?.anthropic ?? {}
  options.providerOptions = {
    ...options.providerOptions,
    anthropic: {
      ...existing,
      cacheControl: ANTHROPIC_CACHE_CONTROL,
    },
  }
}
