import { describe, expect, it } from 'vitest'
import extractOpenaiCompatibleCost from '@/services/billing/extract-openai-compatible-cost'

describe('extractOpenaiCompatibleCost', () => {
  it('returns OpenRouter provider cost and cost_details verbatim', () => {
    const raw = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      cost: 0.00123,
      cost_details: { upstream_inference_cost: 0.001 },
      prompt_tokens_details: {
        cached_tokens: 20,
        cache_write_tokens: 10,
      },
      completion_tokens_details: {
        reasoning_tokens: 15,
      },
    }

    expect(extractOpenaiCompatibleCost(raw)).toEqual({
      costUSD: 0.00123,
      costDetails: { upstream_inference_cost: 0.001 },
    })
  })

  it('returns null cost when raw has no cost (no rate math)', () => {
    expect(
      extractOpenaiCompatibleCost({
        prompt_tokens: 100,
        completion_tokens: 50,
      }),
    ).toEqual({ costUSD: null })
  })

  it('returns null for non-object raw', () => {
    expect(extractOpenaiCompatibleCost(undefined)).toEqual({ costUSD: null })
    expect(extractOpenaiCompatibleCost(null)).toEqual({ costUSD: null })
    expect(extractOpenaiCompatibleCost('0.01')).toEqual({ costUSD: null })
  })

  it('does not invent cost from string or non-finite numbers', () => {
    expect(extractOpenaiCompatibleCost({ cost: '0.01' })).toEqual({
      costUSD: null,
    })
    expect(extractOpenaiCompatibleCost({ cost: Number.NaN })).toEqual({
      costUSD: null,
    })
  })
})
