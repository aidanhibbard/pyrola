import { describe, expect, it } from 'vitest'
import normalizeCodegraphResult from '@/services/codegraph/normalize-codegraph-result'

describe('normalizeCodegraphResult.tool', () => {
  it('parses explore file sections with line numbers', () => {
    const raw = {
      content: [
        {
          type: 'text',
          text: [
            '**`src/auth/session.ts`**',
            '```ts',
            '10\texport const loadSession = () => {',
            '11\t  return null',
            '12\t}',
            '```',
          ].join('\n'),
        },
      ],
    }

    expect(normalizeCodegraphResult.tool(raw)).toEqual({
      summary: expect.stringContaining('src/auth/session.ts'),
      results: [
        {
          path: 'src/auth/session.ts',
          startLine: 10,
          endLine: 12,
          snippet: expect.stringContaining('loadSession'),
        },
      ],
    })
  })

  it('parses search locations', () => {
    const text = [
      '**Search Results (1 found)**',
      '',
      '**loadSession** (function)',
      'src/auth/session.ts:10',
      '`const loadSession = () => null`',
      '',
    ].join('\n')

    expect(normalizeCodegraphResult.tool({ content: [{ type: 'text', text }] })).toEqual({
      summary: text,
      results: [
        {
          path: 'src/auth/session.ts',
          startLine: 10,
          endLine: 10,
          symbol: 'loadSession',
        },
      ],
    })
  })

  it('falls back to summary with empty results for unknown shapes', () => {
    expect(normalizeCodegraphResult.tool({ content: [{ type: 'text', text: 'weird' }] })).toEqual({
      summary: 'weird',
      results: [],
    })
  })

  it('parses flat files listings', () => {
    const text = [
      '**Files (2)**',
      '',
      '- src/components/project/codegraph/NeighborhoodExplorer.vue (vue, 12 symbols)',
      '- AGENTS.md (markdown, 0 symbols)',
    ].join('\n')

    expect(normalizeCodegraphResult.files({ content: [{ type: 'text', text }] })).toEqual({
      summary: text,
      results: [
        {
          path: 'src/components/project/codegraph/NeighborhoodExplorer.vue',
          startLine: 1,
          endLine: 1,
        },
        {
          path: 'AGENTS.md',
          startLine: 1,
          endLine: 1,
        },
      ],
    })
  })

  it('parses node symbolsOnly listings', () => {
    const text = [
      '**src/auth/session.ts** \u2014 2 symbols, no other indexed file depends on it',
      '',
      '**Symbols**',
      '- `loadSession` (function) \u2014 :10',
      '- `refreshSession` (function) const refreshSession = () => {} \u2014 :44',
    ].join('\n')

    expect(
      normalizeCodegraphResult.node({ content: [{ type: 'text', text }] }, 'src/auth/session.ts'),
    ).toEqual({
      summary: text,
      results: [
        {
          path: 'src/auth/session.ts',
          startLine: 10,
          endLine: 10,
          symbol: 'loadSession',
        },
        {
          path: 'src/auth/session.ts',
          startLine: 44,
          endLine: 44,
          symbol: 'refreshSession',
        },
      ],
    })
  })
})

describe('normalizeCodegraphResult.impact', () => {
  it('parses file-grouped impact symbols', () => {
    const text = [
      '**Impact: "loadSession" affects 2 symbols**',
      '',
      '**src/auth/session.ts:**',
      'loadSession:10, refreshSession:44',
      '',
    ].join('\n')

    expect(normalizeCodegraphResult.impact({ content: [{ type: 'text', text }] })).toEqual({
      summary: text,
      results: [
        {
          path: 'src/auth/session.ts',
          startLine: 10,
          endLine: 10,
          symbol: 'loadSession',
        },
        {
          path: 'src/auth/session.ts',
          startLine: 44,
          endLine: 44,
          symbol: 'refreshSession',
        },
      ],
    })
  })
})

describe('normalizeCodegraphResult.status', () => {
  it('marks ready when files are indexed', () => {
    const text = [
      '**CodeGraph Status**',
      '',
      '**Files indexed:** 12',
      '**Total nodes:** 100',
      '**Total edges:** 40',
      '**Languages**',
      '- typescript',
      '- vue',
    ].join('\n')

    expect(normalizeCodegraphResult.status({ content: [{ type: 'text', text }] })).toMatchObject({
      ready: true,
      indexing: false,
      syncing: false,
      filesIndexed: 12,
      totalNodes: 100,
      totalEdges: 40,
      languages: ['typescript', 'vue'],
      detail: '12 files, 100 nodes, 40 edges, typescript, vue',
    })
  })

  it('captures pending sync files', () => {
    const text = [
      '**CodeGraph Status**',
      '',
      '**Files indexed:** 3',
      '',
      '**Pending sync:**',
      '- src/a.ts (edited 10ms ago, pending sync)',
      '- src/b.ts (edited 20ms ago, indexing in progress)',
    ].join('\n')

    expect(normalizeCodegraphResult.status({ content: [{ type: 'text', text }] })).toMatchObject({
      ready: true,
      indexing: true,
      syncing: true,
      pendingFiles: ['src/a.ts', 'src/b.ts'],
      filesIndexed: 3,
      detail: '3 files',
    })
  })

  it('marks not ready when index is missing', () => {
    expect(
      normalizeCodegraphResult.status({
        content: [{ type: 'text', text: 'No files indexed. Run `codegraph index` first.' }],
      }),
    ).toMatchObject({
      ready: false,
      error: 'Graph index is missing or empty',
    })
  })
})
