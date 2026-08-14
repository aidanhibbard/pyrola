import { describe, expect, it } from 'vitest'
import applyReplace, { applyReplaceAt } from '@/services/workspace-search/apply-replace'
import type { SearchReplaceOptions } from '@/types/workbench/search-replace-options'

const literal = (
  overrides: Partial<SearchReplaceOptions> = {},
): SearchReplaceOptions => ({
  matchCase: true,
  wholeWord: false,
  regex: false,
  ...overrides,
})

describe('applyReplace', () => {
  it('replaces literal matches', () => {
    expect(applyReplace('foo bar foo', 'foo', 'baz', literal())).toEqual({
      content: 'baz bar baz',
      count: 2,
    })
  })

  it('is case-insensitive when matchCase is false', () => {
    expect(
      applyReplace('Foo foo FOO', 'foo', 'x', literal({ matchCase: false })),
    ).toEqual({
      content: 'x x x',
      count: 3,
    })
  })

  it('respects match case when enabled', () => {
    expect(
      applyReplace('Foo foo FOO', 'foo', 'x', literal({ matchCase: true })),
    ).toEqual({
      content: 'Foo x FOO',
      count: 1,
    })
  })

  it('matches whole words only', () => {
    expect(
      applyReplace('cat catalog cat', 'cat', 'dog', literal({ wholeWord: true })),
    ).toEqual({
      content: 'dog catalog dog',
      count: 2,
    })
  })

  it('supports regex capture groups with $1', () => {
    expect(
      applyReplace(
        'hello world',
        '(hello) (world)',
        '$2-$1',
        literal({ regex: true }),
      ),
    ).toEqual({
      content: 'world-hello',
      count: 1,
    })
  })

  it('keeps $ literal in non-regex replace strings', () => {
    expect(applyReplace('foo', 'foo', '$1', literal())).toEqual({
      content: '$1',
      count: 1,
    })
  })

  it('returns zero count when nothing matches', () => {
    expect(applyReplace('abc', 'zzz', 'x', literal())).toEqual({
      content: 'abc',
      count: 0,
    })
  })

  it('replaces multiple non-overlapping hits on one line', () => {
    expect(applyReplace('foo foo foo', 'foo', 'x', literal())).toEqual({
      content: 'x x x',
      count: 3,
    })
  })

  it('does not re-match overlapping replacements', () => {
    expect(applyReplace('aaa', 'aa', 'b', literal())).toEqual({
      content: 'ba',
      count: 1,
    })
  })

  it('escapes regex metacharacters in literal mode', () => {
    expect(applyReplace('a+b a+b', 'a+b', 'x', literal())).toEqual({
      content: 'x x',
      count: 2,
    })
  })

  it('supports regex without capture groups', () => {
    expect(
      applyReplace('a1 b2 c3', '\\d', '#', literal({ regex: true })),
    ).toEqual({
      content: 'a# b# c#',
      count: 3,
    })
  })

  it('combines whole word with case-insensitive regex', () => {
    expect(
      applyReplace(
        'Cat catalog CAT',
        'cat',
        'dog',
        literal({ regex: true, wholeWord: true, matchCase: false }),
      ),
    ).toEqual({
      content: 'dog catalog dog',
      count: 2,
    })
  })
})

describe('applyReplaceAt', () => {
  it('replaces a single hit by line and columns', () => {
    const content = 'alpha\nfoo foo foo\nbeta'
    expect(
      applyReplaceAt(content, 'foo', 'x', literal(), {
        lineNumber: 2,
        startColumn: 5,
        endColumn: 8,
      }),
    ).toEqual({
      content: 'alpha\nfoo x foo\nbeta',
      count: 1,
    })
  })

  it('replaces the first match on a line when columns are omitted', () => {
    const content = 'foo foo'
    expect(
      applyReplaceAt(content, 'foo', 'x', literal(), { lineNumber: 1 }),
    ).toEqual({
      content: 'x foo',
      count: 1,
    })
  })

  it('supports regex $1 for a column-scoped hit', () => {
    const content = 'id: abc-123'
    expect(
      applyReplaceAt(
        content,
        'abc-(\\d+)',
        'num-$1',
        literal({ regex: true }),
        { lineNumber: 1, startColumn: 5, endColumn: 12 },
      ),
    ).toEqual({
      content: 'id: num-123',
      count: 1,
    })
  })

  it('returns zero when columns do not match the find pattern', () => {
    const content = 'foo bar'
    expect(
      applyReplaceAt(content, 'foo', 'x', literal(), {
        lineNumber: 1,
        startColumn: 5,
        endColumn: 8,
      }),
    ).toEqual({
      content: 'foo bar',
      count: 0,
    })
  })

  it('returns zero for out-of-range line numbers', () => {
    expect(
      applyReplaceAt('only', 'only', 'x', literal(), { lineNumber: 3 }),
    ).toEqual({
      content: 'only',
      count: 0,
    })
  })
})
