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
})
