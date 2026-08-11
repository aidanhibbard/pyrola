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

  it('round-trips browser-element mentions through attrs', () => {
    const mention = {
      type: 'browser-element' as const,
      screenshotPath: '/tmp/shot.png',
      detail: {
        xpath: '/html[1]/body[1]/button[1]',
        cssSelector: 'button.submit',
        role: 'button',
        name: 'Submit',
        attributes: { type: 'submit' },
        boundingBox: { x: 1, y: 2, width: 3, height: 4 },
        computedStyles: { display: 'block' },
        componentHint: null,
        screenshotPath: '/tmp/shot.png',
        outerHTML: null,
        innerText: null,
        pageUrl: null,
        ancestorPath: null,
        matchedCss: null,
      },
    }

    const attrs = contextMentionFromNode.toAttrs(mention)
    expect(attrs.mentionType).toBe('browser-element')
    expect(attrs.path).toBe('/tmp/shot.png')
    expect(contextMentionFromNode.fromAttrs(attrs)).toEqual(mention)
  })
})
