import { describe, expect, it } from 'vitest'
import highlightQueryMatches from '@/utils/highlight-query-matches'

describe('highlightQueryMatches', () => {
  it('keeps the space after Qwen so the unmatched span does not start with whitespace', () => {
    expect(highlightQueryMatches('Qwen 3 14B', 'qwen')).toEqual([
      { text: 'Qwen ', matched: true },
      { text: '3 14B', matched: false },
    ])
  })
})
