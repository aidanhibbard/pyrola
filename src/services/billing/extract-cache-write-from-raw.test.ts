import { describe, expect, it } from 'vitest'
import extractCacheWriteFromRaw from '@/services/billing/extract-cache-write-from-raw'

describe('extractCacheWriteFromRaw', () => {
  it('prefers usage.cacheWriteTokens when present', () => {
    expect(
      extractCacheWriteFromRaw(
        { cacheWriteTokens: 42 },
        { cache_write_tokens: 99 },
      ),
    ).toBe(42)
  })

  it('reads OpenRouter top-level cache_write_tokens from raw', () => {
    expect(
      extractCacheWriteFromRaw(undefined, {
        prompt_tokens: 100,
        cache_write_tokens: 17,
      }),
    ).toBe(17)
  })

  it('reads OpenRouter prompt_tokens_details.cache_write_tokens', () => {
    expect(
      extractCacheWriteFromRaw(
        { cacheWriteTokens: undefined },
        {
          prompt_tokens: 100,
          prompt_tokens_details: {
            cached_tokens: 20,
            cache_write_tokens: 11,
          },
        },
      ),
    ).toBe(11)
  })

  it('returns undefined when cache write is absent', () => {
    expect(
      extractCacheWriteFromRaw(undefined, {
        prompt_tokens: 100,
        prompt_tokens_details: { cached_tokens: 20 },
      }),
    ).toBeUndefined()
    expect(extractCacheWriteFromRaw(undefined, undefined)).toBeUndefined()
  })

  it('returns zero when usage reports zero cache writes', () => {
    expect(extractCacheWriteFromRaw({ cacheWriteTokens: 0 }, {})).toBe(0)
  })
})
