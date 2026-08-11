import { beforeEach, describe, expect, it, vi } from 'vitest'
import type CdpClient from '@/services/browser/cdp-client'

type FakeHandler = (params: unknown, sessionId?: string) => void

const createFakeClient = () => {
  const handlers = new Map<string, Set<FakeHandler>>()
  const send = vi.fn<
    (method: string, params?: Record<string, unknown>, sessionId?: string) => Promise<unknown>
  >(async () => ({}))
  const on = vi.fn<(method: string, handler: FakeHandler) => () => void>((method, handler) => {
    let set = handlers.get(method)
    if (!set) {
      set = new Set()
      handlers.set(method, set)
    }
    set.add(handler)
    return () => {
      set?.delete(handler)
    }
  })

  const emit = (method: string, params: unknown, sessionId?: string): void => {
    const set = handlers.get(method)
    if (!set) {
      return
    }
    for (const handler of set) {
      handler(params, sessionId)
    }
  }

  const listenerCount = (method: string): number => handlers.get(method)?.size ?? 0

  const client = {
    send,
    on,
  } as unknown as CdpClient

  return { client, send, on, emit, listenerCount }
}

describe('cdp-inspect-mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enables Overlay, sets searchForNode with showInfo, and picks matching session nodes', async () => {
    const { client, send, on, emit } = createFakeClient()
    const onPick = vi.fn<(backendNodeId: number) => void>()

    const { startInspectMode } = await import('@/services/browser/cdp-inspect-mode')
    await startInspectMode(client, 'sess-1', onPick)

    expect(send).toHaveBeenNthCalledWith(1, 'DOM.enable', {}, 'sess-1')
    expect(send).toHaveBeenNthCalledWith(2, 'DOM.getDocument', { depth: 0 }, 'sess-1')
    expect(send).toHaveBeenNthCalledWith(3, 'Overlay.enable', {}, 'sess-1')
    expect(send).toHaveBeenNthCalledWith(
      4,
      'Overlay.setInspectMode',
      {
        mode: 'searchForNode',
        highlightConfig: {
          borderColor: { r: 255, g: 0, b: 0, a: 0.9 },
          contentColor: { r: 255, g: 0, b: 0, a: 0.15 },
          showInfo: true,
        },
      },
      'sess-1',
    )
    expect(on).toHaveBeenCalledWith('Overlay.inspectNodeRequested', expect.any(Function))

    emit('Overlay.inspectNodeRequested', { backendNodeId: 42 }, 'sess-1')
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith(42)

    emit('Overlay.inspectNodeRequested', { backendNodeId: 99 }, 'sess-1')
    expect(onPick).toHaveBeenCalledTimes(2)
    expect(onPick).toHaveBeenLastCalledWith(99)
  })

  it('ignores inspectNodeRequested events from a non-matching session', async () => {
    const { client, emit } = createFakeClient()
    const onPick = vi.fn<(backendNodeId: number) => void>()

    const { startInspectMode } = await import('@/services/browser/cdp-inspect-mode')
    await startInspectMode(client, 'sess-1', onPick)

    emit('Overlay.inspectNodeRequested', { backendNodeId: 7 }, 'sess-other')
    expect(onPick).not.toHaveBeenCalled()

    emit('Overlay.inspectNodeRequested', { backendNodeId: 8 }, 'sess-1')
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith(8)
  })

  it('stopInspectMode sets mode none with highlightConfig, hides highlight, disables Overlay, unsubscribes, and is safe when never started', async () => {
    const { client, send, emit, listenerCount } = createFakeClient()
    const onPick = vi.fn<(backendNodeId: number) => void>()

    const { startInspectMode, stopInspectMode } = await import(
      '@/services/browser/cdp-inspect-mode'
    )

    const noneHighlightConfig = {
      borderColor: { r: 255, g: 0, b: 0, a: 0.9 },
      contentColor: { r: 255, g: 0, b: 0, a: 0.15 },
      showInfo: false,
    }

    await expect(stopInspectMode(client, 'sess-never')).resolves.toBeUndefined()
    expect(send).toHaveBeenCalledWith(
      'Overlay.setInspectMode',
      { mode: 'none', highlightConfig: noneHighlightConfig },
      'sess-never',
    )
    expect(send).toHaveBeenCalledWith('Overlay.hideHighlight', {}, 'sess-never')
    expect(send).toHaveBeenCalledWith('Overlay.disable', {}, 'sess-never')

    send.mockClear()
    await startInspectMode(client, 'sess-1', onPick)
    expect(listenerCount('Overlay.inspectNodeRequested')).toBe(1)

    send.mockClear()
    await stopInspectMode(client, 'sess-1')

    expect(send).toHaveBeenCalledWith(
      'Overlay.setInspectMode',
      { mode: 'none', highlightConfig: noneHighlightConfig },
      'sess-1',
    )
    expect(send).toHaveBeenCalledWith('Overlay.hideHighlight', {}, 'sess-1')
    expect(send).toHaveBeenCalledWith('Overlay.disable', {}, 'sess-1')
    expect(listenerCount('Overlay.inspectNodeRequested')).toBe(0)

    emit('Overlay.inspectNodeRequested', { backendNodeId: 1 }, 'sess-1')
    expect(onPick).not.toHaveBeenCalled()
  })
})
