import { describe, expect, it } from 'vitest'
import formatShellExitReason from '@/services/harness/format-shell-exit-reason'

describe('format-shell-exit-reason', () => {
  it('formats normal exit codes', () => {
    expect(formatShellExitReason({ exitCode: 1 })).toBe('1')
    expect(formatShellExitReason({ exitCode: 0 })).toBe('0')
  })

  it('formats signal deaths', () => {
    expect(formatShellExitReason({ exitCode: -1, signal: 6 })).toBe('killed by signal 6')
    expect(formatShellExitReason({ exitCode: -1, signal: 9 })).toBe('killed by signal 9')
  })
})
