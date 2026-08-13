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

describe('mode allowlists studio shell tools', () => {
  it('includes run_terminal, terminal_output, and stop_terminal in studio', () => {
    expect(MODE_TOOL_ALLOWLIST.studio).toContain('run_terminal')
    expect(MODE_TOOL_ALLOWLIST.studio).toContain('terminal_output')
    expect(MODE_TOOL_ALLOWLIST.studio).toContain('stop_terminal')
  })
})

describe('mode allowlists browser tools', () => {
  const browserTools = [
    'browser_tabs',
    'browser_navigate',
    'browser_lock',
    'browser_snapshot',
    'browser_take_screenshot',
    'browser_click',
    'browser_type',
    'browser_fill',
    'browser_select_option',
    'browser_press_key',
    'browser_scroll',
    'browser_drag',
    'browser_get_bounding_box',
    'browser_highlight',
    'browser_cdp',
  ]

  it('includes browser tools in agent and orchestrator', () => {
    for (const name of browserTools) {
      expect(MODE_TOOL_ALLOWLIST.agent).toContain(name)
      expect(MODE_TOOL_ALLOWLIST.orchestrator).toContain(name)
    }
  })

  it('excludes browser tools from ask, plan, and studio', () => {
    for (const name of browserTools) {
      expect(MODE_TOOL_ALLOWLIST.ask).not.toContain(name)
      expect(MODE_TOOL_ALLOWLIST.plan).not.toContain(name)
      expect(MODE_TOOL_ALLOWLIST.studio).not.toContain(name)
    }
  })
})

describe('mode allowlists web_fetch', () => {
  it('includes web_fetch in ask, plan, studio, agent, and orchestrator', () => {
    expect(MODE_TOOL_ALLOWLIST.ask).toContain('web_fetch')
    expect(MODE_TOOL_ALLOWLIST.plan).toContain('web_fetch')
    expect(MODE_TOOL_ALLOWLIST.studio).toContain('web_fetch')
    expect(MODE_TOOL_ALLOWLIST.agent).toContain('web_fetch')
    expect(MODE_TOOL_ALLOWLIST.orchestrator).toContain('web_fetch')
  })

  it('does not treat web_fetch as a browser tool', () => {
    expect(MODE_TOOL_ALLOWLIST.ask).toContain('web_fetch')
    expect(MODE_TOOL_ALLOWLIST.ask).not.toContain('browser_navigate')
    expect(MODE_TOOL_ALLOWLIST.ask).not.toContain('browser_snapshot')
  })
})
