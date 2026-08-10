import { describe, expect, it } from 'vitest'
import {
  detectMcpToolFingerprintDrift,
  fingerprintMcpTools,
} from '@/services/mcp/mcp-tool-baseline'

describe('mcp-tool-baseline', () => {
  it('fingerprints tools stably by name description and schema', async () => {
    const a = await fingerprintMcpTools([
      {
        name: 'search',
        description: 'Search items',
        inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
      },
    ])
    const b = await fingerprintMcpTools([
      {
        name: 'search',
        description: 'Search items',
        inputSchema: { properties: { q: { type: 'string' } }, type: 'object' },
      },
    ])
    expect(a.search).toBe(b.search)
  })

  it('detects changed added and removed tools', () => {
    const drift = detectMcpToolFingerprintDrift(
      { search: 'aaa', list: 'bbb' },
      { search: 'zzz', old: 'ccc' },
    )
    expect(drift.changed).toEqual(['search'])
    expect(drift.added).toEqual(['list'])
    expect(drift.removed).toEqual(['old'])
  })
})
