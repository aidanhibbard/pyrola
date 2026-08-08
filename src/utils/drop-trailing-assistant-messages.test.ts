import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'
import dropTrailingAssistantMessages from '@/utils/drop-trailing-assistant-messages'

describe('dropTrailingAssistantMessages', () => {
  it('removes trailing assistant messages', () => {
    const messages: UIMessage[] = [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
      { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'one' }] },
      { id: 'a2', role: 'assistant', parts: [{ type: 'text', text: 'two' }] },
    ]
    expect(dropTrailingAssistantMessages(messages)).toEqual([messages[0]])
  })

  it('keeps a trailing user message', () => {
    const messages: UIMessage[] = [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
      { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'one' }] },
      { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'again' }] },
    ]
    expect(dropTrailingAssistantMessages(messages)).toEqual(messages)
  })

  it('returns empty when all messages are assistant', () => {
    const messages: UIMessage[] = [
      { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'only' }] },
    ]
    expect(dropTrailingAssistantMessages(messages)).toEqual([])
  })
})
