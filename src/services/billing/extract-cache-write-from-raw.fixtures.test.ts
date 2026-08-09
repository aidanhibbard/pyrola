import { describe, expect, it } from 'vitest'
import extractCacheWriteFromRaw from '@/services/billing/extract-cache-write-from-raw'

/**
 * Golden cache-write resolution order:
 * 1. usage.cacheWriteTokens
 * 2. raw.cache_write_tokens (OpenRouter top-level)
 * 3. raw.prompt_tokens_details.cache_write_tokens
 * 4. undefined
 */
describe('extractCacheWriteFromRaw fixtures', () => {
  it('usage.cacheWriteTokens present => that value', () => {
    expect(
      extractCacheWriteFromRaw(
        { cacheWriteTokens: 42 },
        {
          cache_write_tokens: 99,
          prompt_tokens_details: { cache_write_tokens: 11 },
        },
      ),
    ).toBe(42)
  })

  it('else raw.cache_write_tokens (OpenRouter top-level)', () => {
    expect(
      extractCacheWriteFromRaw(undefined, {
        prompt_tokens: 100,
        cache_write_tokens: 17,
        prompt_tokens_details: { cache_write_tokens: 11 },
      }),
    ).toBe(17)
  })

  it('else raw.prompt_tokens_details.cache_write_tokens', () => {
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

  it('else undefined', () => {
    expect(
      extractCacheWriteFromRaw(undefined, {
        prompt_tokens: 100,
        prompt_tokens_details: { cached_tokens: 20 },
      }),
    ).toBeUndefined()
    expect(extractCacheWriteFromRaw(undefined, undefined)).toBeUndefined()
    expect(extractCacheWriteFromRaw(undefined, null)).toBeUndefined()
  })
})
