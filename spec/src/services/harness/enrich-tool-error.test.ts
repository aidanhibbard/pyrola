import { describe, expect, it } from 'vitest'
import enrichToolError from '@/services/harness/enrich-tool-error'

describe('enrich-tool-error', () => {
  it('adds hint for unrecognized patch header', () => {
    const result = enrichToolError('Unrecognized patch header: --- a/src/main.ts')
    expect(result).toContain('OpenCode format')
  })

  it('returns original message when no hint matches', () => {
    const result = enrichToolError('Something unexpected happened')
    expect(result).toBe('Something unexpected happened')
  })
})
