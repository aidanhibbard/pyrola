/**
 * Resolve cache-write tokens from normalized usage, else OpenRouter-style raw.
 * Never invents a value: absent => undefined.
 */
export default (
  usage: { cacheWriteTokens?: number } | undefined,
  raw: unknown,
): number | undefined => {
  if (usage?.cacheWriteTokens !== undefined) {
    return usage.cacheWriteTokens
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined
  }

  const record = raw as Record<string, unknown>
  const topLevel = record.cache_write_tokens
  if (typeof topLevel === 'number' && Number.isFinite(topLevel)) {
    return topLevel
  }

  const details = record.prompt_tokens_details
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return undefined
  }

  const nested = (details as Record<string, unknown>).cache_write_tokens
  if (typeof nested === 'number' && Number.isFinite(nested)) {
    return nested
  }

  return undefined
}
