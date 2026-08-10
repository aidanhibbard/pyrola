import { describe, expect, it } from 'vitest'
import resolveBuiltinReasoningCapability from '@/services/models/resolve-builtin-model-capabilities'

describe('resolveBuiltinReasoningCapability', () => {
  it('resolves OpenAI gpt-5.1 effort subset', () => {
    expect(
      resolveBuiltinReasoningCapability({
        providerId: 'openai',
        modelId: 'gpt-5.1',
      }),
    ).toEqual({
      supported: true,
      levels: ['provider-default', 'none', 'low', 'medium', 'high'],
      mandatory: false,
    })
  })

  it('resolves OpenAI gpt-5.2 effort subset including xhigh', () => {
    expect(
      resolveBuiltinReasoningCapability({
        providerId: 'openai',
        modelId: 'gpt-5.2',
      }),
    ).toEqual({
      supported: true,
      levels: ['provider-default', 'none', 'low', 'medium', 'high', 'xhigh'],
      mandatory: false,
    })
  })

  it('resolves OpenAI gpt-5-pro as mandatory high only', () => {
    expect(
      resolveBuiltinReasoningCapability({
        providerId: 'openai',
        modelId: 'gpt-5-pro',
      }),
    ).toEqual({
      supported: true,
      levels: ['high'],
      mandatory: true,
    })
  })

  it('resolves Anthropic Opus 4-6 with xhigh but not max', () => {
    expect(
      resolveBuiltinReasoningCapability({
        providerId: 'anthropic',
        modelId: 'claude-opus-4-6',
      }),
    ).toEqual({
      supported: true,
      levels: ['provider-default', 'low', 'medium', 'high', 'xhigh'],
      mandatory: false,
    })
  })

  it('resolves Anthropic Opus 4-8 with max', () => {
    expect(
      resolveBuiltinReasoningCapability({
        providerId: 'anthropic',
        modelId: 'claude-opus-4-8',
      }),
    ).toEqual({
      supported: true,
      levels: ['provider-default', 'low', 'medium', 'high', 'xhigh', 'max'],
      mandatory: false,
    })
  })

  it('resolves Google gemini-3.5-flash effort subset', () => {
    expect(
      resolveBuiltinReasoningCapability({
        providerId: 'google',
        modelId: 'gemini-3.5-flash',
      }),
    ).toEqual({
      supported: true,
      levels: ['provider-default', 'minimal', 'low', 'medium', 'high'],
      mandatory: false,
    })
  })

  it('reuses Anthropic family rules for Gateway anthropic/ ids', () => {
    expect(
      resolveBuiltinReasoningCapability({
        providerId: 'gateway',
        modelId: 'anthropic/claude-opus-5',
      }),
    ).toEqual({
      supported: true,
      levels: ['provider-default', 'low', 'medium', 'high', 'xhigh', 'max'],
      mandatory: false,
    })
  })

  it('reuses OpenAI family rules for OpenRouter openai/ ids', () => {
    expect(
      resolveBuiltinReasoningCapability({
        providerId: 'openrouter',
        modelId: 'openai/gpt-5.2',
      }),
    ).toEqual({
      supported: true,
      levels: ['provider-default', 'none', 'low', 'medium', 'high', 'xhigh'],
      mandatory: false,
    })
  })
})
