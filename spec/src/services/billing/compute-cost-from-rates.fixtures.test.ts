import { describe, expect, it } from 'vitest'
import computeCostFromRates from '@/services/billing/compute-cost-from-rates'
import type { ModelPricingRates } from '@/types/billing/model-pricing-rates'

/**
 * Rounding: assert USD with absolute tolerance of 1e-9 (sub-nanodollar).
 * Rate math is (tokens * ratePerMillion) / 1_000_000 with IEEE doubles;
 * exact equality holds for the integer-ish fixtures below, but tolerance
 * documents the ship-block precision contract for floating results.
 */
const USD_TOLERANCE = 1e-9

const expectUsdClose = (actual: number, expected: number): void => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(USD_TOLERANCE)
}

const anthropicRates: ModelPricingRates = {
  inputPerMillion: 3,
  outputPerMillion: 15,
  cacheReadPerMillion: 0.3,
  cacheWritePerMillion: 3.75,
}

const openaiRates: ModelPricingRates = {
  inputPerMillion: 2.5,
  outputPerMillion: 10,
  cacheReadPerMillion: 1.25,
  cacheWritePerMillion: 2.5,
}

const googleRates: ModelPricingRates = {
  inputPerMillion: 0.15,
  outputPerMillion: 0.6,
  cacheReadPerMillion: 0.0375,
}

describe('computeCostFromRates fixtures', () => {
  it('Anthropic-style exclusive math (inputTokens = noCache + cacheRead + cacheWrite)', () => {
    // uncached=1000@$3, read=50@$0.30, write=50@$3.75, output=200@$15
    const expected =
      (1000 * 3) / 1_000_000 +
      (50 * 0.3) / 1_000_000 +
      (50 * 3.75) / 1_000_000 +
      (200 * 15) / 1_000_000

    const actual = computeCostFromRates(
      {
        inputTokens: 1100,
        noCacheTokens: 1000,
        cacheReadTokens: 50,
        cacheWriteTokens: 50,
        outputTokens: 200,
      },
      anthropicRates,
    )

    expectUsdClose(actual, expected)
    expect(actual).toBe(expected)
  })

  it('OpenAI-style: inputTokens includes cacheRead, noCacheTokens present => no double-count', () => {
    // inputTokens=120 includes cacheRead=40; bill noCache=80 only for input
    const expected =
      (80 * 2.5) / 1_000_000 +
      (40 * 1.25) / 1_000_000 +
      (80 * 10) / 1_000_000

    const actual = computeCostFromRates(
      {
        inputTokens: 120,
        noCacheTokens: 80,
        cacheReadTokens: 40,
        outputTokens: 80,
        textTokens: 55,
        reasoningTokens: 25,
      },
      openaiRates,
    )

    expectUsdClose(actual, expected)
    expect(actual).toBe(expected)
  })

  it('Google: reasoning inside outputTokens, reasoningPerMillion unset => no double-bill', () => {
    // output=150 includes thoughts=50; no reasoningPerMillion => output only
    const expected =
      (80 * 0.15) / 1_000_000 +
      (20 * 0.0375) / 1_000_000 +
      (150 * 0.6) / 1_000_000

    const actual = computeCostFromRates(
      {
        inputTokens: 100,
        noCacheTokens: 80,
        cacheReadTokens: 20,
        outputTokens: 150,
        textTokens: 100,
        reasoningTokens: 50,
      },
      googleRates,
    )

    expectUsdClose(actual, expected)
    expect(actual).toBe(expected)
  })

  it('reasoning separate bucket (outputTokens === textTokens) => added when rate set', () => {
    const rates: ModelPricingRates = {
      inputPerMillion: 3,
      outputPerMillion: 15,
      reasoningPerMillion: 15,
    }
    const expected =
      (100 * 3) / 1_000_000 +
      (40 * 15) / 1_000_000 +
      (20 * 15) / 1_000_000

    const actual = computeCostFromRates(
      {
        inputTokens: 100,
        noCacheTokens: 100,
        outputTokens: 40,
        textTokens: 40,
        reasoningTokens: 20,
      },
      rates,
    )

    expectUsdClose(actual, expected)
    expect(actual).toBe(expected)
  })
})
