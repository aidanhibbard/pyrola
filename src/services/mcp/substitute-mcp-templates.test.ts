import { describe, expect, it } from 'vitest'
import {
  collectMcpTemplateInputIds,
  collectRecordInputIds,
  substituteMcpRecord,
  substituteMcpTemplate,
} from '@/services/mcp/substitute-mcp-templates'

describe('substitute-mcp-templates', () => {
  it('substitutes input and env templates', () => {
    expect(
      substituteMcpTemplate('Bearer ${input:token} from ${env:HOME}', {
        inputs: { token: 'secret' },
        env: { HOME: '/tmp' },
      }),
    ).toBe('Bearer secret from /tmp')
  })

  it('substitutes records and returns empty for undefined', () => {
    expect(
      substituteMcpRecord(
        { Authorization: 'Bearer ${input:token}' },
        { inputs: { token: 'abc' }, env: {} },
      ),
    ).toEqual({ Authorization: 'Bearer abc' })
    expect(substituteMcpRecord(undefined, { inputs: {}, env: {} })).toEqual({})
  })

  it('collects input ids from strings and records', () => {
    expect(collectMcpTemplateInputIds('a ${input:one} b ${input:two}')).toEqual([
      'one',
      'two',
    ])
    expect(
      collectRecordInputIds({
        a: '${input:token}',
        b: 'plain',
        c: '${input:token} ${input:org}',
      }),
    ).toEqual(['token', 'org'])
    expect(collectRecordInputIds(undefined)).toEqual([])
  })

  it('throws when input or env is missing', () => {
    expect(() =>
      substituteMcpTemplate('${input:missing}', { inputs: {}, env: {} }),
    ).toThrow('Missing MCP input: missing')

    expect(() =>
      substituteMcpTemplate('${env:MISSING}', { inputs: {}, env: {} }),
    ).toThrow('Missing environment variable: MISSING')
  })
})
