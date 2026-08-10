import { describe, expect, it } from 'vitest'
import formatRelativeTime from '@/utils/format-relative-time'

describe('format-relative-time', () => {
  it('returns empty string for invalid timestamps', () => {
    expect(formatRelativeTime('not-a-date')).toBe('')
  })

  it('formats recent past times', () => {
    const now = Date.parse('2026-08-09T12:00:00.000Z')
    expect(formatRelativeTime('2026-08-09T11:59:30.000Z', now)).toMatch(/second/)
    expect(formatRelativeTime('2026-08-09T11:00:00.000Z', now)).toMatch(/hour/)
  })
})
