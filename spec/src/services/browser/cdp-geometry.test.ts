import { beforeEach, describe, expect, it, vi } from 'vitest'
import type CdpClient from '@/services/browser/cdp-client'

const createFakeClient = () => {
  const send = vi.fn<
    (method: string, params?: Record<string, unknown>, sessionId?: string) => Promise<unknown>
  >(async (method) => {
    if (method === 'Accessibility.getFullAXTree') {
      return {
        nodes: [
          {
            nodeId: 'btn',
            role: { value: 'button' },
            name: { value: 'Go' },
            backendDOMNodeId: 99,
            childIds: [],
          },
        ],
      }
    }
    if (method === 'DOM.resolveNode') {
      return { object: { objectId: 'obj-1' } }
    }
    if (method === 'DOM.getBoxModel') {
      return {
        model: {
          border: [10, 20, 50, 20, 50, 60, 10, 60],
        },
      }
    }
    return {}
  })

  const client = { send } as unknown as CdpClient
  return { client, send }
}

describe('cdp-geometry', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { resetSnapshotsForTests } = await import('@/services/browser/cdp-snapshot')
    resetSnapshotsForTests()
  })

  it('highlight enables DOM and CSS before Overlay.highlightNode', async () => {
    const { client, send } = createFakeClient()
    const { getAccessibilitySnapshot } = await import('@/services/browser/cdp-snapshot')
    await getAccessibilitySnapshot(client, 'sess-1')

    const { highlight } = await import('@/services/browser/cdp-geometry')
    await highlight(client, 'sess-1', 'btn')

    const methods = send.mock.calls.map((call) => call[0])
    const overlayIndex = methods.indexOf('Overlay.highlightNode')
    expect(overlayIndex).toBeGreaterThan(-1)
    expect(methods.slice(0, overlayIndex)).toEqual(
      expect.arrayContaining(['DOM.enable', 'DOM.getDocument', 'CSS.enable', 'Overlay.enable']),
    )
    expect(send).toHaveBeenCalledWith('DOM.resolveNode', { backendNodeId: 99 }, 'sess-1')
    expect(send).toHaveBeenCalledWith(
      'Overlay.highlightNode',
      expect.objectContaining({
        backendNodeId: 99,
        highlightConfig: expect.objectContaining({ showInfo: true }),
      }),
      'sess-1',
    )
    expect(send).toHaveBeenCalledWith('Overlay.hideHighlight', {}, 'sess-1')
  })

  it('getBoxModelForObject enables DOM before DOM.getBoxModel', async () => {
    const { client, send } = createFakeClient()
    const { getBoxModelForObject } = await import('@/services/browser/cdp-geometry')
    const box = await getBoxModelForObject(client, 'sess-1', 'obj-1')

    expect(send).toHaveBeenNthCalledWith(1, 'DOM.enable', {}, 'sess-1')
    expect(send).toHaveBeenNthCalledWith(2, 'DOM.getBoxModel', { objectId: 'obj-1' }, 'sess-1')
    expect(box).toEqual({ x: 10, y: 20, width: 40, height: 40 })
  })
})
