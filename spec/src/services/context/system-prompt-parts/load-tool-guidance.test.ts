import { describe, expect, it } from 'vitest'
import loadToolGuidanceForMode from '@/services/context/system-prompt-parts/load-tool-guidance'

describe('loadToolGuidanceForMode', () => {
  it('always includes shared codebase and LSP guidance', () => {
    const ask = loadToolGuidanceForMode('ask')
    expect(ask).toContain('codebase_explore')
    expect(ask).toContain('function calls')
    expect(ask).not.toContain('browser_cdp')
  })

  it('adds browser guidance only for agent and orchestrator', () => {
    expect(loadToolGuidanceForMode('agent')).toContain('browser_lock')
    expect(loadToolGuidanceForMode('orchestrator')).toContain('browser_lock')
    expect(loadToolGuidanceForMode('studio')).not.toContain('browser_lock')
  })
})
