import { describe, expect, it } from 'vitest'
import deriveToolArtifact from '@/services/harness/derive-tool-artifact'

describe('deriveToolArtifact', () => {
  it('returns file artifacts for read, delete, and move', () => {
    expect(
      deriveToolArtifact('read_file', { path: 'src/a.ts', content: 'x' }),
    ).toEqual({ kind: 'file', path: 'src/a.ts' })
    expect(
      deriveToolArtifact('delete_file', { ok: true, path: 'src/a.ts', diffs: [] }),
    ).toEqual({ kind: 'file', path: 'src/a.ts' })
    expect(
      deriveToolArtifact(
        'move_file',
        { ok: true, from: 'a.ts', to: 'b.ts', diffs: [] },
        { from: 'a.ts', to: 'b.ts' },
      ),
    ).toEqual({ kind: 'file', path: 'b.ts' })
  })

  it('returns the first path for apply_patch', () => {
    expect(
      deriveToolArtifact('apply_patch', {
        ok: true,
        paths: ['one.ts', 'two.ts'],
        diffs: [],
      }),
    ).toEqual({ kind: 'file', path: 'one.ts' })
  })

  it('returns the first codebase span with path and lines', () => {
    expect(
      deriveToolArtifact('codebase_search', {
        summary: '2 matches',
        results: [
          {
            path: 'src/services/auth.ts',
            startLine: 44,
            endLine: 60,
            symbol: 'loginUser',
          },
          {
            path: 'src/other.ts',
            startLine: 1,
            endLine: 1,
          },
        ],
      }),
    ).toEqual({
      kind: 'file',
      path: 'src/services/auth.ts',
      label: 'loginUser (auth.ts:44-60)',
      startLine: 44,
      endLine: 60,
    })
  })

  it('returns file label with line for explore spans without symbol', () => {
    expect(
      deriveToolArtifact('codebase_explore', {
        results: [{ path: 'src/a.ts', startLine: 10, endLine: 10 }],
      }),
    ).toEqual({
      kind: 'file',
      path: 'src/a.ts',
      label: 'a.ts:10',
      startLine: 10,
      endLine: 10,
    })
  })

  it('returns undefined for codebase tools with empty results', () => {
    expect(
      deriveToolArtifact('codebase_impact', { summary: 'none', results: [] }),
    ).toBeUndefined()
  })
})
