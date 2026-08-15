import type { SystemModelMessage } from 'ai'

type CallProviderOptions = {
  anthropic?: {
    cacheControl?: unknown
  }
}

const isEphemeralCacheControl = (
  value: unknown,
): value is { type: 'ephemeral' } => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  return 'type' in value && value.type === 'ephemeral'
}

/**
 * AI SDK v7 `instructions` / `system` may be a SystemModelMessage so
 * providerOptions.anthropic.cacheControl lands on the frozen system block.
 * Call-level providerOptions.anthropic.cacheControl is also sent as request
 * cache_control (automatic last-block caching).
 */
export default (
  system: string,
  providerOptions?: CallProviderOptions,
): string | SystemModelMessage => {
  const cacheControl = providerOptions?.anthropic?.cacheControl
  if (!isEphemeralCacheControl(cacheControl)) {
    return system
  }
  return {
    role: 'system',
    content: system,
    providerOptions: {
      anthropic: { cacheControl },
    },
  }
}
