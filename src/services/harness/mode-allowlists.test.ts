import { describe, expect, it } from 'vitest'
import { MODE_TOOL_ALLOWLIST } from '@/services/harness/mode-allowlists'

describe('mode allowlists codebase tools', () => {
  const codebaseTools = [
    'codebase_explore',
    'codebase_search',
    'codebase_impact',
    'codebase_status',
  ]

  it('includes codebase tools in ask, plan, agent, orchestrator, and studio', () => {
    for (const name of codebaseTools) {
      expect(MODE_TOOL_ALLOWLIST.ask).toContain(name)
      expect(MODE_TOOL_ALLOWLIST.plan).toContain(name)
      expect(MODE_TOOL_ALLOWLIST.agent).toContain(name)
      expect(MODE_TOOL_ALLOWLIST.orchestrator).toContain(name)
      expect(MODE_TOOL_ALLOWLIST.studio).toContain(name)
    }
  })
})
