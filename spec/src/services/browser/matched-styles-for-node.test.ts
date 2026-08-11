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

describe('matchedStylesForNode', () => {
  const client = { send } as unknown as CdpClient
  const sessionId = 'sess-1'
  const objectId = 'obj-1'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('enables CSS, resolves nodeId, and serializes matched, inherited, and inline styles', async () => {
    send.mockImplementation(async (method) => {
      if (method === 'DOM.enable' || method === 'CSS.enable') {
        return {}
      }
      if (method === 'DOM.requestNode') {
        return { nodeId: 7 }
      }
      if (method === 'CSS.getMatchedStylesForNode') {
        return {
          matchedCSSRules: [
            {
              rule: {
                selectorList: { text: 'button.primary' },
                style: { cssText: 'color: red; font-weight: 600;' },
              },
            },
          ],
          inherited: [
            {
              matchedCSSRules: [
                {
                  rule: {
                    selectorList: { text: 'body' },
                    style: { cssText: 'font-family: sans-serif;' },
                  },
                },
              ],
            },
          ],
          inlineStyle: { cssText: 'margin: 4px;' },
          attributesStyle: { cssText: 'width: 100px;' },
        }
      }
      throw new Error(`Unexpected method: ${method}`)
    })

    const { default: matchedStylesForNode } = await import(
      '@/services/browser/matched-styles-for-node'
    )

    const result = await matchedStylesForNode(client, sessionId, objectId)

    expect(send).toHaveBeenCalledWith('DOM.enable', {}, sessionId)
    expect(send).toHaveBeenCalledWith('CSS.enable', {}, sessionId)
    expect(send).toHaveBeenCalledWith('DOM.requestNode', { objectId }, sessionId)
    expect(send).toHaveBeenCalledWith(
      'CSS.getMatchedStylesForNode',
      { nodeId: 7 },
      sessionId,
    )
    expect(result).toContain('button.primary { color: red; font-weight: 600; }')
    expect(result).toContain('Inherited from ancestor 1:')
    expect(result).toContain('body { font-family: sans-serif; }')
    expect(result).toContain('Inline style:')
    expect(result).toContain('margin: 4px;')
    expect(result).toContain('Attribute style:')
    expect(result).toContain('width: 100px;')
  })

  it('truncates oversized matched CSS with a marker', async () => {
    const hugeCss = `a { color: ${'x'.repeat(40_000)}; }`
    send.mockImplementation(async (method) => {
      if (method === 'DOM.enable' || method === 'CSS.enable') {
        return {}
      }
      if (method === 'DOM.requestNode') {
        return { nodeId: 3 }
      }
      if (method === 'CSS.getMatchedStylesForNode') {
        return {
          matchedCSSRules: [
            {
              rule: {
                selectorList: { text: 'a' },
                style: { cssText: hugeCss },
              },
            },
          ],
        }
      }
      return {}
    })

    const { default: matchedStylesForNode } = await import(
      '@/services/browser/matched-styles-for-node'
    )

    const result = await matchedStylesForNode(client, sessionId, objectId)

    expect(result).not.toBeNull()
    expect(result!.endsWith('...[truncated]')).toBe(true)
    expect(result!.length).toBe(32 * 1024 + '...[truncated]'.length)
  })

  it('returns null when CSS enrichment fails', async () => {
    send.mockImplementation(async (method) => {
      if (method === 'DOM.enable' || method === 'CSS.enable') {
        return {}
      }
      if (method === 'DOM.requestNode') {
        throw new Error('CSS domain unavailable')
      }
      return {}
    })

    const { default: matchedStylesForNode } = await import(
      '@/services/browser/matched-styles-for-node'
    )

    await expect(matchedStylesForNode(client, sessionId, objectId)).resolves.toBeNull()
  })

  it('returns null when requestNode does not yield a nodeId', async () => {
    send.mockImplementation(async (method) => {
      if (method === 'DOM.enable' || method === 'CSS.enable') {
        return {}
      }
      if (method === 'DOM.requestNode') {
        return {}
      }
      return {}
    })

    const { default: matchedStylesForNode } = await import(
      '@/services/browser/matched-styles-for-node'
    )

    await expect(matchedStylesForNode(client, sessionId, objectId)).resolves.toBeNull()
  })
})
