import { beforeEach, describe, expect, it, vi } from 'vitest'
import type CdpClient from '@/services/browser/cdp-client'

const send = vi.hoisted(() =>
  vi.fn<
    (
      method: string,
      params?: Record<string, unknown>,
      sessionId?: string,
    ) => Promise<unknown>
  >(),
)

describe('probeElementDom', () => {
  const client = { send } as unknown as CdpClient
  const sessionId = 'sess-1'
  const objectId = 'obj-1'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('parses extended probe fields from Runtime.callFunctionOn', async () => {
    send.mockResolvedValue({
      result: {
        value: {
          xpath: '/html[1]/body[1]/button[1]',
          cssSelector: 'button.submit.primary',
          attributes: { class: 'submit primary' },
          computedStyles: { display: 'inline-block' },
          outerHTML: '<button class="submit primary">Go</button>',
          innerText: 'Go',
          pageUrl: 'https://example.com/',
          ancestorPath: 'button.submit.primary > form#f > body > html',
        },
      },
    })

    const { default: probeElementDom } = await import(
      '@/services/browser/probe-element-dom'
    )

    const probe = await probeElementDom(client, sessionId, objectId)

    expect(send).toHaveBeenCalledWith(
      'Runtime.callFunctionOn',
      expect.objectContaining({
        objectId,
        returnByValue: true,
        functionDeclaration: expect.stringContaining('ancestorPathFor'),
      }),
      sessionId,
    )
    expect(probe).toEqual({
      xpath: '/html[1]/body[1]/button[1]',
      cssSelector: 'button.submit.primary',
      attributes: { class: 'submit primary' },
      computedStyles: { display: 'inline-block' },
      outerHTML: '<button class="submit primary">Go</button>',
      innerText: 'Go',
      pageUrl: 'https://example.com/',
      ancestorPath: 'button.submit.primary > form#f > body > html',
    })
  })

  it('defaults missing optional probe fields to null', async () => {
    send.mockResolvedValue({
      result: {
        value: {
          xpath: '/html[1]/body[1]/div[1]',
          attributes: {},
          computedStyles: {},
        },
      },
    })

    const { default: probeElementDom } = await import(
      '@/services/browser/probe-element-dom'
    )

    const probe = await probeElementDom(client, sessionId, objectId)

    expect(probe.cssSelector).toBeNull()
    expect(probe.outerHTML).toBeNull()
    expect(probe.innerText).toBeNull()
    expect(probe.pageUrl).toBeNull()
    expect(probe.ancestorPath).toBeNull()
  })

  it('throws when xpath is missing', async () => {
    send.mockResolvedValue({
      result: {
        value: {
          attributes: {},
          computedStyles: {},
        },
      },
    })

    const { default: probeElementDom } = await import(
      '@/services/browser/probe-element-dom'
    )

    await expect(probeElementDom(client, sessionId, objectId)).rejects.toThrow(
      /missing xpath/,
    )
  })
})
