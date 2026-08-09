import { describe, expect, it } from 'vitest'
import resolveReasoningCapability from '@/services/models/resolve-reasoning-capability'
import {
  mapReasoningToCallOptions,
  pickResolvedReasoning,
  resolveReasoningForRole,
} from '@/services/models/resolve-reasoning-for-call'
import { resolveModelCallOptions } from '@/services/models/resolve-model-call-options'
import resolveModelForRole from '@/services/models/resolve-model-for-role'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'

const baseSettings = {
  version: 1,
  'models.default': 'anthropic::claude-sonnet-4-5',
  'models.agent': 'openai::gpt-4o',
  'models.subagent': 'google::gemini-2.0-flash',
  'models.defaultReasoning': 'low',
  'models.agentReasoning': 'high',
} as PyrolaSettings

describe('resolveReasoningCapability', () => {
  it('supports native anthropic models', () => {
    const capability = resolveReasoningCapability(baseSettings, {
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-5',
    })
    expect(capability.supported).toBe(true)
    expect(capability.levels).toContain('medium')
  })

  it('hides effort for custom models without supportsReasoningEffort', () => {
    const settings = {
      ...baseSettings,
      'providers.custom.local': {
        type: 'openai-compatible',
        name: 'Local',
        baseURL: 'http://127.0.0.1:11434/v1',
        models: [{ id: 'llama' }],
      },
    } as PyrolaSettings
    const capability = resolveReasoningCapability(settings, {
      providerId: 'local',
      modelId: 'llama',
    })
    expect(capability.supported).toBe(false)
  })

  it('hides effort when custom model only has thinking enabled', () => {
    const settings = {
      ...baseSettings,
      'providers.custom.local': {
        type: 'openai-compatible',
        name: 'Local',
        baseURL: 'http://127.0.0.1:11434/v1',
        models: [{ id: 'qwen', thinking: true }],
      },
    } as PyrolaSettings
    const capability = resolveReasoningCapability(settings, {
      providerId: 'local',
      modelId: 'qwen',
    })
    expect(capability.supported).toBe(false)
  })

  it('shows effort when custom model lists supportsReasoningEffort', () => {
    const settings = {
      ...baseSettings,
      'providers.custom.local': {
        type: 'openai-compatible',
        name: 'Local',
        baseURL: 'http://127.0.0.1:11434/v1',
        models: [{
          id: 'qwen',
          thinking: true,
          supportsReasoningEffort: ['low', 'high'],
        }],
      },
    } as PyrolaSettings
    const capability = resolveReasoningCapability(settings, {
      providerId: 'local',
      modelId: 'qwen',
    })
    expect(capability.supported).toBe(true)
    expect(capability.levels).toEqual(['provider-default', 'low', 'high'])
  })
})

describe('resolveReasoningForRole / pickResolvedReasoning', () => {
  it('prefers role reasoning over default', () => {
    expect(resolveReasoningForRole('agent', baseSettings)).toBe('high')
    expect(resolveReasoningForRole('ask', baseSettings)).toBe('low')
  })

  it('picks first valid candidate', () => {
    expect(pickResolvedReasoning(['nope', 'medium', 'high'])).toBe('medium')
  })
})

describe('mapReasoningToCallOptions', () => {
  it('uses top-level reasoning for anthropic', () => {
    const mapped = mapReasoningToCallOptions(
      baseSettings,
      { providerId: 'anthropic', modelId: 'claude-sonnet-4-5' },
      'high',
    )
    expect(mapped.reasoning).toBe('high')
    expect(mapped.providerOptionsKey).toBeUndefined()
  })

  it('maps catalog openai-compatible routers to openai providerOptions', () => {
    const mapped = mapReasoningToCallOptions(
      baseSettings,
      { providerId: 'openrouter', modelId: 'anthropic/claude-sonnet-4' },
      'low',
    )
    expect(mapped.providerOptionsKey).toBe('openai')
    expect(mapped.providerOptionsReasoningEffort).toBe('low')
  })
})

describe('resolveModelCallOptions with reasoning', () => {
  it('includes top-level reasoning for gateway', () => {
    const options = resolveModelCallOptions(
      baseSettings,
      { providerId: 'gateway', modelId: 'openai/gpt-5' },
      { reasoning: 'medium' },
    )
    expect(options.reasoning).toBe('medium')
  })
})

describe('resolveModelForRole subagent', () => {
  it('uses models.subagent before agent fallback', () => {
    expect(resolveModelForRole('subagent', baseSettings)).toBe(
      'google::gemini-2.0-flash',
    )
  })

  it('falls back to agent then default', () => {
    const settings = {
      version: 1,
      'models.default': 'anthropic::claude-sonnet-4-5',
      'models.agent': 'openai::gpt-4o',
    } as PyrolaSettings
    expect(resolveModelForRole('subagent', settings)).toBe('openai::gpt-4o')
  })
})
