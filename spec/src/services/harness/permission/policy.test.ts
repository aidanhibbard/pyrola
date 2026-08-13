import { describe, expect, it } from 'vitest'
import { decidePermission } from '@/services/harness/permission/policy'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'

const baseSettings = (
  permissions: PyrolaSettings['agent.permissions'] = [],
): PyrolaSettings =>
  ({
    version: 1,
    'agent.permissions': permissions,
  }) as PyrolaSettings

describe('decidePermission web.fetch', () => {
  it('asks by default', () => {
    const decision = decidePermission({
      action: 'web.fetch',
      capability: 'web.fetch:example.com',
      settings: baseSettings(),
      permissionLevel: 'ask',
      sessionAllows: new Set(),
      sessionDenies: new Set(),
      sandboxEnabled: true,
    })

    expect(decision.verdict).toBe('ask')
    expect(decision.allowedScopes).toEqual([
      'once',
      'session',
      'workspace',
      'always',
      'never',
    ])
  })

  it('does not auto-allow under bypass', () => {
    const decision = decidePermission({
      action: 'web.fetch',
      capability: 'web.fetch:example.com',
      settings: baseSettings(),
      permissionLevel: 'bypass',
      sessionAllows: new Set(),
      sessionDenies: new Set(),
      sandboxEnabled: true,
    })

    expect(decision.verdict).toBe('ask')
  })

  it('allows when sessionAllows has web.fetch:host', () => {
    const decision = decidePermission({
      action: 'web.fetch',
      capability: 'web.fetch:example.com',
      settings: baseSettings(),
      permissionLevel: 'ask',
      sessionAllows: new Set(['web.fetch:example.com']),
      sessionDenies: new Set(),
      sandboxEnabled: true,
    })

    expect(decision.verdict).toBe('allow')
  })

  it('allows when sessionAllows has broad web.fetch', () => {
    const decision = decidePermission({
      action: 'web.fetch',
      capability: 'web.fetch:example.com',
      settings: baseSettings(),
      permissionLevel: 'ask',
      sessionAllows: new Set(['web.fetch']),
      sessionDenies: new Set(),
      sandboxEnabled: true,
    })

    expect(decision.verdict).toBe('allow')
  })

  it('allows when persisted allow exists', () => {
    const decision = decidePermission({
      action: 'web.fetch',
      capability: 'web.fetch:example.com',
      settings: baseSettings([
        {
          capability: 'web.fetch:example.com',
          verdict: 'allow',
          scope: 'workspace',
        },
      ]),
      permissionLevel: 'ask',
      sessionAllows: new Set(),
      sessionDenies: new Set(),
      sandboxEnabled: true,
    })

    expect(decision.verdict).toBe('allow')
  })
})
