import { describe, expect, it } from 'vitest'
import type { ProviderModelGroup } from '@/types/models/provider-model-group'
import {
  filterProviderModelGroups,
  filterScoredProviderModels,
} from '@/services/models/search'

const catalog: ProviderModelGroup[] = [
  {
    providerId: 'gateway',
    providerName: 'Vercel AI Gateway',
    models: [
      { providerId: 'gateway', modelId: 'anthropic/claude-sonnet-4' },
      { providerId: 'gateway', modelId: 'anthropic/claude-sonnet-4.5' },
      { providerId: 'gateway', modelId: 'openai/gpt-4o' },
      {
        providerId: 'gateway',
        modelId: 'moonshotai/kimi-k3',
        supportsFast: true,
        fastModelId: 'moonshotai/kimi-k3-fast',
      },
    ],
  },
  {
    providerId: 'openai',
    providerName: 'OpenAI',
    models: [
      { providerId: 'openai', modelId: 'gpt-4o' },
      { providerId: 'openai', modelId: 'o3-mini' },
    ],
  },
  {
    providerId: 'anthropic',
    providerName: 'Anthropic',
    models: [
      { providerId: 'anthropic', modelId: 'claude-sonnet-4' },
      { providerId: 'anthropic', modelId: 'claude-opus-4' },
    ],
  },
]

describe('filterScoredProviderModels', () => {
  it('ranks claude sonnet 4 above claude sonnet 4.5 for spaced query', () => {
    const matches = filterScoredProviderModels(catalog, 'claude sonnet 4')
    const ids = matches.map((match) => match.model.modelId)
    const sonnet4 = matches.find(
      (match) => match.model.modelId === 'anthropic/claude-sonnet-4',
    )
    const sonnet45 = matches.find(
      (match) => match.model.modelId === 'anthropic/claude-sonnet-4.5',
    )

    expect(sonnet4).toBeDefined()
    expect(sonnet45).toBeDefined()
    expect(sonnet4!.score).toBeGreaterThan(sonnet45!.score)
    expect(ids.indexOf('anthropic/claude-sonnet-4')).toBeLessThan(
      ids.indexOf('anthropic/claude-sonnet-4.5'),
    )
  })

  it('treats hyphens and spaces as equivalent', () => {
    const spaced = filterScoredProviderModels(catalog, 'claude sonnet 4')
    const hyphenated = filterScoredProviderModels(catalog, 'claude-sonnet-4')

    expect(spaced.map((match) => match.model.modelId).sort()).toEqual(
      hyphenated.map((match) => match.model.modelId).sort(),
    )
    expect(
      spaced.find((match) => match.model.modelId === 'anthropic/claude-sonnet-4')
        ?.score,
    ).toBe(
      hyphenated.find(
        (match) => match.model.modelId === 'anthropic/claude-sonnet-4',
      )?.score,
    )
  })

  it('returns a provider catalog when the query matches the provider name', () => {
    const matches = filterScoredProviderModels(catalog, 'OpenAI')
    const ids = matches.map((match) => match.model.modelId)

    expect(ids).toContain('gpt-4o')
    expect(ids).toContain('o3-mini')
    expect(
      matches.every(
        (match) =>
          match.group.providerId === 'openai' ||
          match.model.modelId.startsWith('openai/'),
      ),
    ).toBe(true)
  })

  it('matches model names without relying on a gateway substring', () => {
    const matches = filterScoredProviderModels(catalog, 'claude sonnet 4')
    const gatewayClaude = matches.find(
      (match) =>
        match.group.providerId === 'gateway' &&
        match.model.modelId === 'anthropic/claude-sonnet-4',
    )

    expect(gatewayClaude).toBeDefined()
    expect(gatewayClaude!.score).toBeGreaterThan(0)
  })

  it('does not dump a provider catalog for a weak provider-id substring', () => {
    const matches = filterScoredProviderModels(catalog, 'ai')
    const openaiProviderModels = matches.filter(
      (match) => match.group.providerId === 'openai',
    )
    const gatewayDump = matches.filter(
      (match) => match.group.providerId === 'gateway',
    )

    expect(openaiProviderModels).toHaveLength(0)
    expect(gatewayDump).toHaveLength(0)
  })

  it('keeps the fast exact-query shortcut', () => {
    const matches = filterScoredProviderModels(catalog, 'fast')
    expect(matches).toHaveLength(1)
    expect(matches[0]?.model.modelId).toBe('moonshotai/kimi-k3')
    expect(matches[0]?.model.supportsFast).toBe(true)
  })
})

describe('filterProviderModelGroups', () => {
  it('returns original groups for an empty query', () => {
    expect(filterProviderModelGroups(catalog, '  ')).toBe(catalog)
  })

  it('maps scored matches back to provider groups', () => {
    const groups = filterProviderModelGroups(catalog, 'claude sonnet 4')
    const modelIds = groups.flatMap((group) =>
      group.models.map((model) => model.modelId),
    )

    expect(modelIds).toContain('anthropic/claude-sonnet-4')
    expect(modelIds).toContain('claude-sonnet-4')
    expect(modelIds).not.toContain('openai/gpt-4o')
  })
})
