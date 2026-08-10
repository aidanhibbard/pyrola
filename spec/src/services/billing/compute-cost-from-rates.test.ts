import { describe, expect, it } from 'vitest'
import computeCostFromRates from '@/services/billing/compute-cost-from-rates'
import type { ModelPricingRates } from '@/types/billing/model-pricing-rates'

const rates: ModelPricingRates = {
  inputPerMillion: 3,
  outputPerMillion: 15,
  cacheReadPerMillion: 0.3,
  cacheWritePerMillion: 3.75,
  reasoningPerMillion: 15,
}

describe('computeCostFromRates', () => {
  it('uses exclusive cache math (uncached + cache read + cache write + output)', () => {
    // uncached=1000 @ $3, read=50 @ $0.30, write=50 @ $3.75, output=200 @ $15
    const expected =
      (1000 * 3) / 1_000_000 +
      (50 * 0.3) / 1_000_000 +
      (50 * 3.75) / 1_000_000 +
      (200 * 15) / 1_000_000
    expect(
      computeCostFromRates(
        {
          inputTokens: 1100,
          noCacheTokens: 1000,
          cacheReadTokens: 50,
          cacheWriteTokens: 50,
          outputTokens: 200,
        },
        rates,
      ),
    ).toBe(expected)
  })

  it('derives uncached from input minus cache when noCacheTokens is absent', () => {
    // uncached = max(0, 1100 - 50 - 50) = 1000
    const expected =
      (1000 * 3) / 1_000_000 +
      (50 * 0.3) / 1_000_000 +
      (50 * 3.75) / 1_000_000 +
      (200 * 15) / 1_000_000
    expect(
      computeCostFromRates(
        {
          inputTokens: 1100,
          cacheReadTokens: 50,
          cacheWriteTokens: 50,
          outputTokens: 200,
        },
        rates,
      ),
    ).toBe(expected)
  })

  it('does not double-bill reasoning when it is already inside outputTokens', () => {
    // Google-style: outputTokens includes thoughts; text + reasoning = output.
    // Cost is output only at outputPerMillion (no extra reasoning charge).
    expect(
      computeCostFromRates(
        {
          inputTokens: 100,
          noCacheTokens: 80,
          cacheReadTokens: 20,
          outputTokens: 150,
          textTokens: 100,
          reasoningTokens: 50,
        },
        rates,
      ),
    ).toBe(
      (80 * 3) / 1_000_000 +
        (20 * 0.3) / 1_000_000 +
        (150 * 15) / 1_000_000,
    )
  })

  it('bills reasoning separately only when it is outside outputTokens', () => {
    // outputTokens === textTokens, reasoning is a separate bucket.
    expect(
      computeCostFromRates(
        {
          inputTokens: 100,
          noCacheTokens: 100,
          outputTokens: 40,
          textTokens: 40,
          reasoningTokens: 20,
        },
        rates,
      ),
    ).toBe(
      (100 * 3) / 1_000_000 +
        (40 * 15) / 1_000_000 +
        (20 * 15) / 1_000_000,
    )
  })

  it('does not add reasoning when reasoningPerMillion is unset', () => {
    expect(
      computeCostFromRates(
        {
          inputTokens: 100,
          noCacheTokens: 100,
          outputTokens: 40,
          textTokens: 40,
          reasoningTokens: 20,
        },
        {
          inputPerMillion: 3,
          outputPerMillion: 15,
        },
      ),
    ).toBe((100 * 3) / 1_000_000 + (40 * 15) / 1_000_000)
  })
})
