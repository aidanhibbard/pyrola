import { describe, expect, it } from 'vitest'
import splitChatMentionText from '@/utils/split-chat-mention-text'

describe('splitChatMentionText', () => {
  it('returns plain text when there are no highlights', () => {
    expect(splitChatMentionText('look in /tmp and ping @someone')).toEqual([
      { type: 'text', value: 'look in /tmp and ping @someone' },
    ])
  })

  it('returns an empty list for empty text', () => {
    expect(splitChatMentionText('')).toEqual([])
  })

  it('highlights only allowlisted skill and mention tokens', () => {
    expect(
      splitChatMentionText('run /review-bugbot on @src/a.ts and /tmp', [
        { kind: 'skill', token: '/review-bugbot' },
        { kind: 'mention', token: '@src/a.ts' },
      ]),
    ).toEqual([
      { type: 'text', value: 'run ' },
      { type: 'skill', value: '/review-bugbot' },
      { type: 'text', value: ' on ' },
      { type: 'mention', value: '@src/a.ts' },
      { type: 'text', value: ' and /tmp' },
    ])
  })

  it('prefers the longest token when matches overlap at the same index', () => {
    expect(
      splitChatMentionText('use /review-bugbot-extra please', [
        { kind: 'skill', token: '/review' },
        { kind: 'skill', token: '/review-bugbot-extra' },
      ]),
    ).toEqual([
      { type: 'text', value: 'use ' },
      { type: 'skill', value: '/review-bugbot-extra' },
      { type: 'text', value: ' please' },
    ])
  })

  it('highlights repeated allowlisted tokens', () => {
    expect(
      splitChatMentionText('/go then /go again', [
        { kind: 'skill', token: '/go' },
      ]),
    ).toEqual([
      { type: 'skill', value: '/go' },
      { type: 'text', value: ' then ' },
      { type: 'skill', value: '/go' },
      { type: 'text', value: ' again' },
    ])
  })
})
