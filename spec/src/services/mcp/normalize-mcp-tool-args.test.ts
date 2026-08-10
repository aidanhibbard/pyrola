import { describe, expect, it } from 'vitest'
import normalizeMcpToolArgs from '@/services/mcp/normalize-mcp-tool-args'

const stringQuerySchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    query: { type: 'string' },
    count: { type: 'number' },
  },
}

describe('normalizeMcpToolArgs', () => {
  it('leaves flat string args unchanged', () => {
    const result = normalizeMcpToolArgs({ query: 'ok' }, stringQuerySchema)
    expect(result).toEqual({ ok: true, args: { query: 'ok' } })
  })

  it('unwraps self-nested string properties', () => {
    const result = normalizeMcpToolArgs(
      { query: { query: 'ok' } },
      stringQuerySchema,
    )
    expect(result).toEqual({ ok: true, args: { query: 'ok' } })
  })

  it('rejects non-self object nests for string properties', () => {
    const result = normalizeMcpToolArgs(
      { query: { test: 'search' } },
      stringQuerySchema,
    )
    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('expected failure')
    }
    expect(result.error).toContain('Expected args.query to be string, got object')
    expect(result.error).toContain('{"query":"search text"}')
  })

  it('leaves non-string schema fields alone', () => {
    const result = normalizeMcpToolArgs(
      { query: 'ok', count: { nested: 1 } },
      stringQuerySchema,
    )
    expect(result).toEqual({
      ok: true,
      args: { query: 'ok', count: { nested: 1 } },
    })
  })

  it('passes through when inputSchema is missing', () => {
    const args = { query: { test: 'search' } }
    expect(normalizeMcpToolArgs(args, null)).toEqual({ ok: true, args })
    expect(normalizeMcpToolArgs(args, undefined)).toEqual({ ok: true, args })
  })

  it('unwraps string unions that include null', () => {
    const schema = {
      type: 'object',
      properties: {
        query: { type: ['string', 'null'] },
      },
    }
    const result = normalizeMcpToolArgs({ query: { query: 'hi' } }, schema)
    expect(result).toEqual({ ok: true, args: { query: 'hi' } })
  })
})
