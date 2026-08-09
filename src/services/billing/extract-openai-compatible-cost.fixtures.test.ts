import { describe, expect, it } from 'vitest'
import extractOpenaiCompatibleCost from '@/services/billing/extract-openai-compatible-cost'

/**
 * Golden OpenRouter-style raw usage payloads. costUSD must equal the fixture
 * number exactly (or null). Never invents rate-based cost.
 */
describe('extractOpenaiCompatibleCost fixtures', () => {
  it('OpenRouter raw with cost number', () => {
    const raw = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      cost: 0.00123,
    }

    expect(extractOpenaiCompatibleCost(raw)).toEqual({
      costUSD: 0.00123,
    })
  })

  it('OpenRouter raw with cost and cost_details', () => {
    const costDetails = {
      upstream_inference_cost: 0.001,
      upstream_inference_prompt_cost: 0.0004,
      upstream_inference_completions_cost: 0.0006,
    }
    const raw = {
      prompt_tokens: 100,
      completion_tokens: 50,
      cost: 0.00123,
      cost_details: costDetails,
    }

    expect(extractOpenaiCompatibleCost(raw)).toEqual({
      costUSD: 0.00123,
      costDetails,
    })
  })

  it('raw without cost => costUSD null', () => {
    expect(
      extractOpenaiCompatibleCost({
        prompt_tokens: 100,
        completion_tokens: 50,
      }),
    ).toEqual({ costUSD: null })
  })

  it('non-finite cost => costUSD null', () => {
    expect(extractOpenaiCompatibleCost({ cost: Number.NaN })).toEqual({
      costUSD: null,
    })
    expect(extractOpenaiCompatibleCost({ cost: Number.POSITIVE_INFINITY })).toEqual({
      costUSD: null,
    })
    expect(extractOpenaiCompatibleCost({ cost: Number.NEGATIVE_INFINITY })).toEqual({
      costUSD: null,
    })
  })

  it('null raw => costUSD null', () => {
    expect(extractOpenaiCompatibleCost(null)).toEqual({ costUSD: null })
  })
})
