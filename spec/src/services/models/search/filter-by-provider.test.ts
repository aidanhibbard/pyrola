import { describe, expect, it } from 'vitest'
import type { ProviderModelGroup } from '@/types/models/provider-model-group'
import { filterByProvider } from '@/services/models/search'

const catalog: ProviderModelGroup[] = [
  {
    providerId: 'gateway',
    providerName: 'Vercel AI Gateway',
    models: [{ providerId: 'gateway', modelId: 'openai/gpt-4o' }],
  },
  {
    providerId: 'openai',
    providerName: 'OpenAI',
    models: [{ providerId: 'openai', modelId: 'gpt-4o' }],
  },
  {
    providerId: 'anthropic',
    providerName: 'Anthropic',
    models: [{ providerId: 'anthropic', modelId: 'claude-sonnet-4' }],
  },
  {
    providerId: 'openrouter',
    providerName: 'OpenRouter',
    models: [{ providerId: 'openrouter', modelId: 'anthropic/claude-sonnet-4' }],
  },
]

describe('filterByProvider', () => {
  it('keeps groups with a strong provider id match', () => {
    const groups = filterByProvider(catalog, 'openai')
    expect(groups.map((group) => group.providerId)).toEqual(['openai'])
  })

  it('keeps groups with a strong provider name match', () => {
    const groups = filterByProvider(catalog, 'Anthropic')
    expect(groups.map((group) => group.providerId)).toEqual(['anthropic'])
  })

  it('does not treat a short token inside a multi-word name as strong', () => {
    const groups = filterByProvider(catalog, 'ai')
    expect(groups).toEqual([])
  })

  it('returns empty for an empty provider string', () => {
    expect(filterByProvider(catalog, '   ')).toEqual([])
  })
})
