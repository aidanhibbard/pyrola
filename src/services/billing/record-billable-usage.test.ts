import { describe, expect, it } from 'vitest'
import type { LanguageModelUsage } from 'ai'
import type { JSONObject } from '@ai-sdk/provider'
import recordBillableUsage from '@/services/billing/record-billable-usage'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'

const settingsWithRates = {
  version: 1,
  'providers.custom.openrouter': {
    type: 'openai-compatible',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    models: [
      {
        id: 'test-model',
        pricing: {
          inputPerMillion: 1,
          outputPerMillion: 2,
        },
      },
    ],
  },
} as PyrolaSettings

const usageWithTokens = (raw?: JSONObject): LanguageModelUsage => ({
  inputTokens: 1_000_000,
  inputTokenDetails: {
    noCacheTokens: 1_000_000,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
  outputTokens: 500_000,
  outputTokenDetails: {
    textTokens: 500_000,
    reasoningTokens: 0,
  },
  totalTokens: 1_500_000,
  raw,
})

describe('recordBillableUsage', () => {
  it('prefers provider-reported cost over user-configured rates', () => {
    const record = recordBillableUsage({
      chatId: 'chat-1',
      turnId: 'turn-1',
      source: 'main',
      providerId: 'openrouter',
      modelId: 'test-model',
      usage: usageWithTokens({ cost: 0.42 }),
      settings: settingsWithRates,
    })

    expect(record.costUSD).toBe(0.42)
    expect(record.pricingSource).toBe('provider_reported')
    expect(record.rates).toBeUndefined()
  })

  it('marks missing usage without inventing tokens or $0', () => {
    const record = recordBillableUsage({
      chatId: 'chat-1',
      turnId: 'turn-1',
      source: 'main',
      providerId: 'openai',
      modelId: 'gpt-4o',
      usage: undefined,
      settings: { version: 1 },
    })

    expect(record.usageMissing).toBe(true)
    expect(record.costUSD).toBeNull()
    expect(record.pricingSource).toBe('none')
    expect(record.usage.inputTokens).toBeUndefined()
    expect(record.usage.outputTokens).toBeUndefined()
  })

  it('leaves gateway cost null for async enrich when raw has no cost', () => {
    const record = recordBillableUsage({
      chatId: 'chat-1',
      turnId: 'turn-1',
      source: 'main',
      providerId: 'gateway',
      modelId: 'openai/gpt-4o',
      usage: usageWithTokens({ prompt_tokens: 10 }),
      settings: { version: 1 },
    })

    expect(record.costUSD).toBeNull()
    expect(record.pricingSource).toBe('none')
    expect(record.usage.inputTokens).toBe(1_000_000)
  })
})
