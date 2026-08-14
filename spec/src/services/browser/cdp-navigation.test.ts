import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  const client = {
    send,
    on,
  } as unknown as CdpClient

  return { client, send, emit }
}

describe('cdp-navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('canGoBack and canGoForward reflect navigation history indexes', async () => {
    const { client, send } = createFakeClient()
    send.mockImplementation(async (method) => {
      if (method === 'Page.enable') {
        return {}
      }
      if (method === 'Page.getNavigationHistory') {
        return {
          currentIndex: 1,
          entries: [
            { id: 10, url: 'https://a.example' },
            { id: 11, url: 'https://b.example' },
            { id: 12, url: 'https://c.example' },
          ],
        }
      }
      return {}
    })

    const { canGoBack, canGoForward } = await import('@/services/browser/cdp-navigation')
    await expect(canGoBack(client, 'sess-1')).resolves.toBe(true)
    await expect(canGoForward(client, 'sess-1')).resolves.toBe(true)
  })

  it('goBack navigates to the previous history entry and waits for load', async () => {
    const { client, send, emit } = createFakeClient()
    send.mockImplementation(async (method) => {
      if (method === 'Page.enable') {
        return {}
      }
      if (method === 'Page.getNavigationHistory') {
        return {
          currentIndex: 1,
          entries: [
            { id: 10, url: 'https://a.example' },
            { id: 11, url: 'https://b.example' },
          ],
        }
      }
      if (method === 'Page.navigateToHistoryEntry') {
        queueMicrotask(() => {
          emit('Page.loadEventFired', {}, 'sess-1')
        })
        return {}
      }
      return {}
    })

    const { goBack } = await import('@/services/browser/cdp-navigation')
    await goBack(client, 'sess-1')

    expect(send).toHaveBeenCalledWith(
      'Page.navigateToHistoryEntry',
      { entryId: 10 },
      'sess-1',
    )
  })

  it('goForward navigates to the next history entry', async () => {
    const { client, send, emit } = createFakeClient()
    send.mockImplementation(async (method) => {
      if (method === 'Page.enable') {
        return {}
      }
      if (method === 'Page.getNavigationHistory') {
        return {
          currentIndex: 0,
          entries: [
            { id: 10, url: 'https://a.example' },
            { id: 11, url: 'https://b.example' },
          ],
        }
      }
      if (method === 'Page.navigateToHistoryEntry') {
        queueMicrotask(() => {
          emit('Page.loadEventFired', {}, 'sess-1')
        })
        return {}
      }
      return {}
    })

    const { goForward } = await import('@/services/browser/cdp-navigation')
    await goForward(client, 'sess-1')

    expect(send).toHaveBeenCalledWith(
      'Page.navigateToHistoryEntry',
      { entryId: 11 },
      'sess-1',
    )
  })

  it('reload calls Page.reload and waits for load', async () => {
    const { client, send, emit } = createFakeClient()
    send.mockImplementation(async (method) => {
      if (method === 'Page.enable') {
        return {}
      }
      if (method === 'Page.reload') {
        queueMicrotask(() => {
          emit('Page.loadEventFired', {}, 'sess-1')
        })
        return {}
      }
      return {}
    })

    const { reload } = await import('@/services/browser/cdp-navigation')
    await reload(client, 'sess-1')

    expect(send.mock.calls.map((call) => call[0])).toEqual(['Page.enable', 'Page.reload'])
  })

  it('hardReload calls Page.reload with ignoreCache true and waits for load', async () => {
    const { client, send, emit } = createFakeClient()
    send.mockImplementation(async (method) => {
      if (method === 'Page.enable') {
        return {}
      }
      if (method === 'Page.reload') {
        queueMicrotask(() => {
          emit('Page.loadEventFired', {}, 'sess-1')
        })
        return {}
      }
      return {}
    })

    const { hardReload } = await import('@/services/browser/cdp-navigation')
    await hardReload(client, 'sess-1')

    expect(send).toHaveBeenCalledWith(
      'Page.reload',
      { ignoreCache: true },
      'sess-1',
    )
    expect(send.mock.calls.map((call) => call[0])).toEqual(['Page.enable', 'Page.reload'])
  })

  it('resetNavigationHistory sends Page.enable then Page.resetNavigationHistory', async () => {
    const { client, send } = createFakeClient()

    const { resetNavigationHistory } = await import('@/services/browser/cdp-navigation')
    await resetNavigationHistory(client, 'sess-1')

    expect(send.mock.calls).toEqual([
      ['Page.enable', {}, 'sess-1'],
      ['Page.resetNavigationHistory', {}, 'sess-1'],
    ])
  })

  it('goBack throws when there is no previous entry', async () => {
    const { client, send } = createFakeClient()
    send.mockImplementation(async (method) => {
      if (method === 'Page.enable') {
        return {}
      }
      if (method === 'Page.getNavigationHistory') {
        return {
          currentIndex: 0,
          entries: [{ id: 10, url: 'https://a.example' }],
        }
      }
      return {}
    })

    const { goBack } = await import('@/services/browser/cdp-navigation')
    await expect(goBack(client, 'sess-1')).rejects.toThrow(
      'No previous navigation history entry',
    )
  })
})
