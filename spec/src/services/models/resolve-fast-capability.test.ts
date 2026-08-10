import { describe, expect, it } from 'vitest'
import resolveSupportsFast from '@/services/models/resolve-fast-capability'

describe('resolveSupportsFast', () => {
  it('returns true for Anthropic Opus 5 and Opus 4-8 ids', () => {
    expect(
      resolveSupportsFast({
        providerId: 'anthropic',
        modelId: 'claude-opus-5',
      }),
    ).toBe(true)
    expect(
      resolveSupportsFast({
        providerId: 'anthropic',
        modelId: 'claude-opus-4-8',
      }),
    ).toBe(true)
    expect(
      resolveSupportsFast({
        providerId: 'anthropic',
        modelId: 'claude-opus-5-20260101',
      }),
    ).toBe(true)
  })

  it('returns false for Anthropic Opus 4-7, Sonnet 5, and Haiku', () => {
    expect(
      resolveSupportsFast({
        providerId: 'anthropic',
        modelId: 'claude-opus-4-7',
      }),
    ).toBe(false)
    expect(
      resolveSupportsFast({
        providerId: 'anthropic',
        modelId: 'claude-sonnet-5',
      }),
    ).toBe(false)
    expect(
      resolveSupportsFast({
        providerId: 'anthropic',
        modelId: 'claude-haiku-4-5',
      }),
    ).toBe(false)
  })

  it('returns true when ModelRef.supportsFast is set regardless of provider', () => {
    expect(
      resolveSupportsFast({
        providerId: 'openrouter',
        modelId: 'moonshotai/kimi-k3',
        supportsFast: true,
      }),
    ).toBe(true)
    expect(
      resolveSupportsFast({
        providerId: 'gateway',
        modelId: 'openai/gpt-4o',
        supportsFast: true,
      }),
    ).toBe(true)
  })

  it('returns false for OpenAI and Google ids without supportsFast', () => {
    expect(
      resolveSupportsFast({
        providerId: 'openai',
        modelId: 'gpt-5.2',
      }),
    ).toBe(false)
    expect(
      resolveSupportsFast({
        providerId: 'google',
        modelId: 'gemini-3.5-flash',
      }),
    ).toBe(false)
  })
})
