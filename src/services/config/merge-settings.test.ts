import { describe, expect, it } from 'vitest'
import {
  isPersonalOnlyProjectKey,
  mergeSettings,
  stripPersonalOnlyProjectOverrides,
} from '@/services/config/merge-settings'
import { parseProjectOverrides } from '@/services/config/pyrola-config'
import { defaultPyrolaSettings } from '@/schemas/pyrola-settings'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'

describe('isPersonalOnlyProjectKey', () => {
  it('matches providers, models, and lsp prefixes', () => {
    expect(isPersonalOnlyProjectKey('providers.openai.apiKeyRef')).toBe(true)
    expect(isPersonalOnlyProjectKey('providers.custom.local')).toBe(true)
    expect(isPersonalOnlyProjectKey('models.default')).toBe(true)
    expect(isPersonalOnlyProjectKey('models.agent')).toBe(true)
    expect(isPersonalOnlyProjectKey('lsp.autoDownload')).toBe(true)
  })

  it('does not match other sections', () => {
    expect(isPersonalOnlyProjectKey('appearance.theme')).toBe(false)
    expect(isPersonalOnlyProjectKey('agent.permissionLevel')).toBe(false)
  })
})

describe('stripPersonalOnlyProjectOverrides', () => {
  it('removes providers, models, and lsp keys while keeping other overrides', () => {
    const project: PyrolaSettings = {
      version: 1,
      'lsp.autoDownload': false,
      'appearance.theme': 'dark',
      'models.default': 'anthropic::claude-sonnet-4-5',
      'providers.openai.apiKeyRef': 'openai',
      'providers.custom.local': {
        type: 'openai-compatible',
        name: 'Local',
        baseURL: 'http://localhost:1234/v1',
      },
    }

    const stripped = stripPersonalOnlyProjectOverrides(project)

    expect(stripped).toEqual({
      version: 1,
      'appearance.theme': 'dark',
    })
  })
})

describe('parseProjectOverrides', () => {
  it('strips providers, models, and lsp keys from project records', () => {
    const parsed = parseProjectOverrides({
      version: 1,
      'lsp.autoDownload': false,
      'appearance.theme': 'dark',
      'models.default': 'openai::gpt-4o',
      'providers.anthropic.apiKeyRef': 'anthropic',
      'providers.custom.kat': {
        type: 'openai-compatible',
        name: 'Kat',
        baseURL: 'http://localhost:1234/v1',
      },
    })

    expect(parsed).toEqual({
      version: 1,
      'appearance.theme': 'dark',
    })
  })
})

describe('mergeSettings with stripped project overrides', () => {
  it('does not let project providers, models, or lsp override personal', () => {
    const personal: PyrolaSettings = {
      ...defaultPyrolaSettings(),
      'models.default': 'anthropic::claude-sonnet-4-5',
      'providers.openai.apiKeyRef': 'openai',
      'lsp.autoDownload': true,
    }
    const projectRaw = {
      version: 1 as const,
      'models.default': 'openai::gpt-4o',
      'providers.openai.apiKeyRef': 'other',
      'lsp.autoDownload': false,
      'appearance.theme': 'dark',
    }
    const project = parseProjectOverrides(projectRaw)
    const effective = mergeSettings(personal, project)

    expect(effective['models.default']).toBe('anthropic::claude-sonnet-4-5')
    expect(effective['providers.openai.apiKeyRef']).toBe('openai')
    expect(effective['lsp.autoDownload']).toBe(true)
    expect(effective['appearance.theme']).toBe('dark')
  })
})

describe('defaultPyrolaSettings', () => {
  it('does not include appearance.fontSize', () => {
    const defaults = defaultPyrolaSettings()
    expect('appearance.fontSize' in defaults).toBe(false)
    expect(defaults['appearance.theme']).toBe('system')
  })
})
