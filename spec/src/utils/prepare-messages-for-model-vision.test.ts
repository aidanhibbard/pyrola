import { describe, expect, it, vi, afterEach } from 'vitest'
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

const userWithJson = (url: string): UIMessage => ({
  id: 'u2',
  role: 'user',
  parts: [
    { type: 'text', text: 'Inspect this' },
    {
      type: 'file',
      mediaType: 'application/json',
      url,
      filename: 'div.element.json',
    },
  ],
})

const userWithMixed = (jsonUrl: string): UIMessage => ({
  id: 'u3',
  role: 'user',
  parts: [
    { type: 'text', text: 'Inspect this' },
    {
      type: 'file',
      mediaType: 'image/png',
      url: 'data:image/png;base64,abc',
      filename: 'shot.png',
    },
    {
      type: 'file',
      mediaType: 'application/json',
      url: jsonUrl,
      filename: 'div.element.json',
    },
  ],
})

describe('prepareMessagesForModelVision', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('passes image file parts through when vision is supported', async () => {
    const messages = [userWithImage()]
    const prepared = await prepareMessagesForModelVision(messages, true)
    expect(prepared).toHaveLength(1)
    expect(prepared[0]).toBe(messages[0])
    expect(prepared[0]!.parts).toEqual(messages[0]!.parts)
  })

  it('inlines non-image file content as text when vision is supported', async () => {
    const json = JSON.stringify({ outerHTML: '<button>Go</button>' })
    const url = `data:application/json;base64,${btoa(json)}`
    const prepared = await prepareMessagesForModelVision([userWithJson(url)], true)
    expect(prepared[0]?.parts).toEqual([
      { type: 'text', text: 'Inspect this' },
      {
        type: 'text',
        text: `Element payload (div.element.json):\n${json}`,
      },
    ])
  })

  it('keeps images and inlines json when vision is supported and parts are mixed', async () => {
    const json = JSON.stringify({ tagName: 'DIV' })
    const url = `data:application/json;base64,${btoa(json)}`
    const prepared = await prepareMessagesForModelVision([userWithMixed(url)], true)
    expect(prepared[0]?.parts).toEqual([
      { type: 'text', text: 'Inspect this' },
      {
        type: 'file',
        mediaType: 'image/png',
        url: 'data:image/png;base64,abc',
        filename: 'shot.png',
      },
      {
        type: 'text',
        text: `Element payload (div.element.json):\n${json}`,
      },
    ])
  })

  it('replaces image file parts with text placeholders when vision is off', async () => {
    const messages = [userWithImage()]
    const prepared = await prepareMessagesForModelVision(messages, false)
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

  it('passes non-image file content as text when vision is off', async () => {
    const json = JSON.stringify({ outerHTML: '<button>Go</button>' })
    const url = `data:application/json;base64,${btoa(json)}`
    const prepared = await prepareMessagesForModelVision([userWithJson(url)], false)
    expect(prepared[0]?.parts).toEqual([
      { type: 'text', text: 'Inspect this' },
      {
        type: 'text',
        text: `Element payload (div.element.json):\n${json}`,
      },
    ])
  })

  it('falls back to placeholder when non-image decode fails and vision is off', async () => {
    const prepared = await prepareMessagesForModelVision(
      [userWithJson('data:application/json;base64,!!!')],
      false,
    )
    expect(prepared[0]?.parts).toEqual([
      { type: 'text', text: 'Inspect this' },
      {
        type: 'text',
        text: '[Attachment: div.element.json (application/json)]',
      },
    ])
  })

  it('falls back to placeholder when non-image decode fails and vision is on', async () => {
    const prepared = await prepareMessagesForModelVision(
      [userWithJson('data:application/json;base64,!!!')],
      true,
    )
    expect(prepared[0]?.parts).toEqual([
      { type: 'text', text: 'Inspect this' },
      {
        type: 'text',
        text: '[Attachment: div.element.json (application/json)]',
      },
    ])
  })

  it('decodes blob: URLs for non-image parts when vision is off', async () => {
    const json = '{"pageUrl":"https://example.com"}'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () => json,
      })),
    )
    const prepared = await prepareMessagesForModelVision(
      [userWithJson('blob:https://app.local/element-1')],
      false,
    )
    expect(prepared[0]?.parts[1]).toEqual({
      type: 'text',
      text: `Element payload (div.element.json):\n${json}`,
    })
  })

  it('does not rewrite non-user messages', async () => {
    const assistant: UIMessage = {
      id: 'a1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'ok' }],
    }
    const messages = [assistant]
    const preparedOff = await prepareMessagesForModelVision(messages, false)
    const preparedOn = await prepareMessagesForModelVision(messages, true)
    expect(preparedOff[0]).toBe(assistant)
    expect(preparedOn[0]).toBe(assistant)
  })
})
