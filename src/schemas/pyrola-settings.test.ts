import { describe, expect, it } from 'vitest'
import { migratePyrolaSettings, normalizeStoredModelRef } from '@/schemas/pyrola-settings'

describe('migratePyrolaSettings', () => {
  it('migrates deprecated provider and model keys', () => {
    const migrated = migratePyrolaSettings({
      version: 1,
      'agent.defaultProvider': 'anthropic',
      'agent.defaultModel': 'claude-sonnet-4-5',
      'chat.autoTitleModel': 'claude-haiku-4-5',
    })

    expect(migrated['models.default']).toBe('anthropic::claude-sonnet-4-5')
    expect(migrated['models.title']).toBe('anthropic::claude-haiku-4-5')
    expect('agent.defaultProvider' in migrated).toBe(false)
    expect('agent.defaultModel' in migrated).toBe(false)
    expect('chat.autoTitleModel' in migrated).toBe(false)
  })

  it('defaults duplicate tab behavior to ask', () => {
    const migrated = migratePyrolaSettings({ version: 1 })

    expect(migrated['workbench.duplicateTabBehavior']).toBe('ask')
  })
})

describe('normalizeStoredModelRef', () => {
  it('normalizes legacy bare model ids with provider hint', () => {
    expect(normalizeStoredModelRef('claude-sonnet-4-5', 'anthropic')).toBe(
      'anthropic::claude-sonnet-4-5',
    )
  })

  it('keeps already serialized values', () => {
    expect(normalizeStoredModelRef('anthropic::claude-sonnet-4-5')).toBe(
      'anthropic::claude-sonnet-4-5',
    )
  })
})
