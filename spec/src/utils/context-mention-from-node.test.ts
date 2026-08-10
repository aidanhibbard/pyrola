import { describe, expect, it } from 'vitest'
import contextMentionFromNode from '@/utils/context-mention-from-node'

describe('contextMentionFromNode.fromAttrs', () => {
  it('treats slash suggestion chars as skills even when mentionType defaults to file', () => {
    expect(
      contextMentionFromNode.fromAttrs({
        id: 'skill:ask',
        label: 'ask',
        mentionSuggestionChar: '/',
        mentionType: 'file',
        path: null,
        name: 'ask',
        query: null,
        startLine: null,
        endLine: null,
        content: null,
      }),
    ).toEqual({ type: 'skill', name: 'ask' })
  })

  it('keeps explicit skill mentionType', () => {
    expect(
      contextMentionFromNode.fromAttrs({
        id: 'skill:ask',
        label: 'ask',
        mentionSuggestionChar: '/',
        mentionType: 'skill',
        path: null,
        name: 'ask',
        query: null,
        startLine: null,
        endLine: null,
        content: null,
      }),
    ).toEqual({ type: 'skill', name: 'ask' })
  })

  it('keeps @ file mentions', () => {
    expect(
      contextMentionFromNode.fromAttrs({
        id: 'file:src/a.ts',
        label: 'src/a.ts',
        mentionSuggestionChar: '@',
        mentionType: 'file',
        path: 'src/a.ts',
        name: null,
        query: null,
        startLine: null,
        endLine: null,
        content: null,
      }),
    ).toEqual({ type: 'file', path: 'src/a.ts' })
  })
})
