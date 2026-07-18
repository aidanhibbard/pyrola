import { describe, expect, it } from 'vitest'
import parseModelRef from '@/utils/parse-model-ref'

describe('parseModelRef', () => {
  it('parses serialized model references', () => {
    expect(parseModelRef('anthropic::claude-sonnet-4-5')).toEqual({
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-5',
    })
    expect(parseModelRef('gateway::openai/gpt-4o')).toEqual({
      providerId: 'gateway',
      modelId: 'openai/gpt-4o',
    })
  })

  it('returns null for empty values', () => {
    expect(parseModelRef('')).toBeNull()
    expect(parseModelRef('   ')).toBeNull()
  })

  it('supports legacy bare model ids with provider hint', () => {
    expect(
      parseModelRef('claude-sonnet-4-5', { legacyProviderId: 'anthropic' }),
    ).toEqual({
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-5',
    })
  })

  it('returns null for bare model ids without provider hint', () => {
    expect(parseModelRef('claude-sonnet-4-5')).toBeNull()
  })
})
