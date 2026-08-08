import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'
import prepareMessagesForModelVision from '@/utils/prepare-messages-for-model-vision'

const userWithImage = (): UIMessage => ({
  id: 'u1',
  role: 'user',
  parts: [
    { type: 'text', text: 'What is this?' },
    {
      type: 'file',
      mediaType: 'image/png',
      url: 'data:image/png;base64,abc',
      filename: 'shot.png',
    },
  ],
})

describe('prepareMessagesForModelVision', () => {
  it('leaves messages unchanged when vision is supported', () => {
    const messages = [userWithImage()]
    expect(prepareMessagesForModelVision(messages, true)).toBe(messages)
  })

  it('replaces file parts with text placeholders when vision is off', () => {
    const messages = [userWithImage()]
    const prepared = prepareMessagesForModelVision(messages, false)
    expect(prepared).toHaveLength(1)
    const [first] = prepared
    expect(first).toBeDefined()
    expect(first!.parts).toEqual([
      { type: 'text', text: 'What is this?' },
      {
        type: 'text',
        text: '[Attachment: shot.png (image/png)]',
      },
    ])
    expect(messages[0]!.parts.some((part) => part.type === 'file')).toBe(true)
  })

  it('does not rewrite non-user messages', () => {
    const assistant: UIMessage = {
      id: 'a1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'ok' }],
    }
    const messages = [assistant]
    const prepared = prepareMessagesForModelVision(messages, false)
    expect(prepared[0]).toBe(assistant)
  })
})
