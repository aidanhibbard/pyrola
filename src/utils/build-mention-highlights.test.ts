import { describe, expect, it } from 'vitest'
import buildMentionHighlights from '@/utils/build-mention-highlights'

describe('buildMentionHighlights', () => {
  it('includes structured mentions', () => {
    expect(
      buildMentionHighlights(
        'see @src/a.ts',
        [{ type: 'file', path: 'src/a.ts' }],
        [],
      ),
    ).toEqual([{ kind: 'mention', token: '@src/a.ts' }])
  })

  it('highlights slash skills found in text from the skill index', () => {
    expect(
      buildMentionHighlights('/ask hello', [], ['ask', 'review-bugbot']),
    ).toEqual([{ kind: 'skill', token: '/ask' }])
  })

  it('does not treat path-like or prefix matches as skills', () => {
    expect(
      buildMentionHighlights('look in /asking and /ask/foo', [], ['ask']),
    ).toEqual([])
  })

  it('merges mention-derived and text-derived skill tokens', () => {
    expect(
      buildMentionHighlights(
        '/ask on @src/a.ts',
        [
          { type: 'skill', name: 'ask' },
          { type: 'file', path: 'src/a.ts' },
        ],
        ['ask'],
      ),
    ).toEqual([
      { kind: 'skill', token: '/ask' },
      { kind: 'mention', token: '@src/a.ts' },
    ])
  })

  it('prefers longer skill names when scanning text', () => {
    expect(
      buildMentionHighlights('/review-bugbot', [], ['review', 'review-bugbot']),
    ).toEqual([{ kind: 'skill', token: '/review-bugbot' }])
  })
})
