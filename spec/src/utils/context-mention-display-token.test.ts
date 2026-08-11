import { describe, expect, it } from 'vitest'
import contextMentionDisplayToken from '@/utils/context-mention-display-token'

describe('contextMentionDisplayToken', () => {
  it('formats skill mentions with a slash', () => {
    expect(contextMentionDisplayToken({ type: 'skill', name: 'review-bugbot' })).toEqual({
      kind: 'skill',
      token: '/review-bugbot',
    })
  })

  it('formats file mentions with @path', () => {
    expect(
      contextMentionDisplayToken({ type: 'file', path: 'src/utils/foo.ts' }),
    ).toEqual({
      kind: 'mention',
      token: '@src/utils/foo.ts',
    })
  })

  it('formats folder mentions with @path', () => {
    expect(contextMentionDisplayToken({ type: 'folder', path: 'src/utils' })).toEqual({
      kind: 'mention',
      token: '@src/utils',
    })
  })

  it('formats rule and symbol names with @', () => {
    expect(contextMentionDisplayToken({ type: 'rule', name: 'no-em-dash' })).toEqual({
      kind: 'mention',
      token: '@no-em-dash',
    })
    expect(
      contextMentionDisplayToken({
        type: 'symbol',
        path: 'src/a.ts',
        name: 'splitChatMentionText',
      }),
    ).toEqual({
      kind: 'mention',
      token: '@splitChatMentionText',
    })
  })

  it('formats codebase mentions with the query label', () => {
    expect(
      contextMentionDisplayToken({ type: 'codebase', query: 'mention highlight' }),
    ).toEqual({
      kind: 'mention',
      token: '@codebase mention highlight',
    })
  })

  it('formats browser-element mentions with the detail label', () => {
    expect(
      contextMentionDisplayToken({
        type: 'browser-element',
        screenshotPath: '/tmp/shot.png',
        detail: {
          xpath: '/html[1]/body[1]/button[1]',
          cssSelector: 'button.submit',
          role: 'button',
          name: 'Submit',
          attributes: {},
          boundingBox: null,
          computedStyles: {},
          componentHint: null,
          screenshotPath: '/tmp/shot.png',
          outerHTML: null,
          innerText: null,
          pageUrl: null,
          ancestorPath: null,
          matchedCss: null,
        },
      }),
    ).toEqual({
      kind: 'mention',
      token: '@Submit',
    })
  })
})
