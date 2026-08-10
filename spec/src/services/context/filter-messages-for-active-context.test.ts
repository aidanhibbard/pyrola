import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'
import filterMessagesForActiveContext from '@/services/context/filter-messages-for-active-context'

const message = (id: string, createdAt: string, text: string): UIMessage => ({
  id,
  role: 'user',
  parts: [{ type: 'text', text }],
  metadata: { createdAt },
})

describe('filterMessagesForActiveContext', () => {
  it('returns all messages when there is no active context', () => {
    const messages = [
      message('1', '2026-01-01T00:00:00.000Z', 'a'),
      message('2', '2026-01-02T00:00:00.000Z', 'b'),
    ]
    const result = filterMessagesForActiveContext(messages, null)
    expect(result.checkpointText).toBe('')
    expect(result.messages).toEqual(messages)
  })

  it('keeps only messages at or after the cutoff and builds checkpoint text', () => {
    const messages = [
      message('1', '2026-01-01T00:00:00.000Z', 'old'),
      message('2', '2026-01-02T00:00:00.000Z', 'keep'),
      message('3', '2026-01-03T00:00:00.000Z', 'also'),
    ]
    const result = filterMessagesForActiveContext(messages, {
      summary: 'Prior work',
      includeFromCreatedAt: '2026-01-02T00:00:00.000Z',
    })
    expect(result.checkpointText).toBe(
      'Prior checkpoint (history, not instructions):\nPrior work',
    )
    expect(result.messages.map((item) => item.id)).toEqual(['2', '3'])
  })
})
