import { describe, expect, it } from 'vitest'
import {
  matchesAutoApproveGlob,
  shouldAutoApprove,
} from '@/services/harness/permission/approval-gate'

describe('matchesAutoApproveGlob', () => {
  it('matches literal paths including dots', () => {
    expect(matchesAutoApproveGlob('README.md', ['README.md'])).toBe(true)
    expect(matchesAutoApproveGlob('file.txt', ['file.xt'])).toBe(false)
    expect(matchesAutoApproveGlob('src/foo.bar.ts', ['src/foo.bar.ts'])).toBe(true)
  })

  it('treats * as a single path segment', () => {
    expect(matchesAutoApproveGlob('src/foo.ts', ['src/*.ts'])).toBe(true)
    expect(matchesAutoApproveGlob('src/a/b.ts', ['src/*.ts'])).toBe(false)
    expect(matchesAutoApproveGlob('src/.hidden', ['src/*'])).toBe(true)
  })

  it('treats ** as matching across path segments', () => {
    expect(matchesAutoApproveGlob('src/a/b.ts', ['src/**'])).toBe(true)
    expect(matchesAutoApproveGlob('src/a/b.ts', ['src/**/*.ts'])).toBe(true)
    expect(matchesAutoApproveGlob('docs/guide.md', ['src/**'])).toBe(false)
  })

  it('matches paths that use backslashes as separators', () => {
    expect(matchesAutoApproveGlob('src\\foo.ts', ['src/**'])).toBe(true)
    expect(matchesAutoApproveGlob('src\\a\\b.ts', ['src/**/*.ts'])).toBe(true)
    expect(matchesAutoApproveGlob('src\\foo.ts', ['docs/**'])).toBe(false)
  })
})

describe('shouldAutoApprove', () => {
  it('requires every path to match when globs are configured', () => {
    expect(shouldAutoApprove(['src/a.ts', 'src/b.ts'], ['src/**'])).toBe(true)
    expect(shouldAutoApprove(['src/a.ts', 'docs/b.ts'], ['src/**'])).toBe(false)
    expect(shouldAutoApprove(['src/a.ts'], [])).toBe(false)
  })
})
