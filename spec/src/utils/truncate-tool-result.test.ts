import { describe, expect, it } from 'vitest'
import truncateToolResult from '@/utils/truncate-tool-result'

describe('truncate-tool-result', () => {
  it('returns non-objects unchanged', () => {
    expect(truncateToolResult('ok')).toBe('ok')
    expect(truncateToolResult(null)).toBeNull()
    expect(truncateToolResult(3)).toBe(3)
  })

  it('strips imageParts from object results', () => {
    expect(
      truncateToolResult({
        summary: 'shot',
        imageParts: [{ data: 'abc' }],
        path: 'a.png',
      }),
    ).toEqual({ summary: 'shot', path: 'a.png' })
  })
})
