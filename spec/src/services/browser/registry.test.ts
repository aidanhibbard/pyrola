import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserTab } from '@/types/browser/browser-tab'

const connectWsUrl = vi.hoisted(() =>
  vi.fn<(wsUrl: string) => Promise<{ send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }>>(),
)

const browserCefGetCdpWsUrl = vi.hoisted(() =>
  vi.fn<(sessionId: string) => Promise<string>>(),
)

vi.mock('@/services/browser/cdp-client', () => ({
  default: {
    connectWsUrl,
  },
}))

vi.mock('@/services/pyrola/pyrola-tauri/browser', () => ({
  browserCefGetCdpWsUrl,
}))

describe('browser-registry (N-session)', () => {
  beforeEach(async () => {
    vi.useRealTimers()
    connectWsUrl.mockResolvedValue({
      send: vi.fn<() => Promise<unknown>>(),
      close: vi.fn<() => void>(),
    })
    browserCefGetCdpWsUrl.mockImplementation(async (sessionId: string) => {
      return `ws://127.0.0.1:9333/devtools/page/${sessionId}`
    })
    const { resetBrowserRegistryForTests } = await import('@/services/browser/registry')
    resetBrowserRegistryForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('acquires and releases a lock per CEF session', async () => {
    const {
      registerCefSession,
      acquireLock,
      releaseLock,
      assertLockedBy,
    } = await import('@/services/browser/registry')

    registerCefSession({ sessionId: 'cef-1', workspaceId: 'ws-1' })

    expect(acquireLock({ sessionId: 'cef-1', chatId: 'chat-a' })).toEqual({ ok: true })
    expect(assertLockedBy({ sessionId: 'cef-1', chatId: 'chat-a' })).toEqual({ ok: true })

    releaseLock({ sessionId: 'cef-1', chatId: 'chat-a' })

    expect(assertLockedBy({ sessionId: 'cef-1', chatId: 'chat-a' }).ok).toBe(false)
  })

  it('allows concurrent locks on different sessions', async () => {
    const { registerCefSession, acquireLock, assertLockedBy } = await import(
      '@/services/browser/registry'
    )

    registerCefSession({ sessionId: 'cef-1', workspaceId: 'ws-1' })
    registerCefSession({ sessionId: 'cef-2', workspaceId: 'ws-1' })

    expect(acquireLock({ sessionId: 'cef-1', chatId: 'chat-a' })).toEqual({ ok: true })
    expect(acquireLock({ sessionId: 'cef-2', chatId: 'chat-b' })).toEqual({ ok: true })
    expect(assertLockedBy({ sessionId: 'cef-1', chatId: 'chat-a' }).ok).toBe(true)
    expect(assertLockedBy({ sessionId: 'cef-2', chatId: 'chat-b' }).ok).toBe(true)
  })

  it('refuses acquire when another chat holds an unexpired lock on the same session', async () => {
    const { registerCefSession, acquireLock } = await import('@/services/browser/registry')

    registerCefSession({ sessionId: 'cef-1', workspaceId: 'ws-1' })
    expect(acquireLock({ sessionId: 'cef-1', chatId: 'chat-a' })).toEqual({ ok: true })

    const denied = acquireLock({ sessionId: 'cef-1', chatId: 'chat-b' })
    expect(denied).toEqual({
      ok: false,
      error: 'browser_locked',
      ownerChatId: 'chat-a',
      leaseExpiresAt: expect.any(Number),
    })
  })

  it('allows the same chat to re-acquire and refresh the lease', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

    const { registerCefSession, acquireLock, getSessionLock } = await import(
      '@/services/browser/registry'
    )

    registerCefSession({ sessionId: 'cef-1', workspaceId: 'ws-1' })
    expect(
      acquireLock({
        sessionId: 'cef-1',
        chatId: 'chat-a',
        leaseMs: 60_000,
      }),
    ).toEqual({ ok: true })

    expect(getSessionLock('cef-1')?.leaseExpiresAt).toBe(
      Date.parse('2026-01-01T00:01:00.000Z'),
    )

    vi.setSystemTime(new Date('2026-01-01T00:00:30.000Z'))

    expect(
      acquireLock({
        sessionId: 'cef-1',
        chatId: 'chat-a',
        subagentId: 'sub-1',
        leaseMs: 60_000,
      }),
    ).toEqual({ ok: true })

    const lock = getSessionLock('cef-1')
    expect(lock?.ownerChatId).toBe('chat-a')
    expect(lock?.ownerSubagentId).toBe('sub-1')
    expect(lock?.leaseExpiresAt).toBe(Date.parse('2026-01-01T00:01:30.000Z'))
  })

  it('takeControl preempts any owner on that session only', async () => {
    const { registerCefSession, acquireLock, takeControl, assertLockedBy } = await import(
      '@/services/browser/registry'
    )

    registerCefSession({ sessionId: 'cef-1', workspaceId: 'ws-1' })
    registerCefSession({ sessionId: 'cef-2', workspaceId: 'ws-1' })

    expect(acquireLock({ sessionId: 'cef-1', chatId: 'chat-a' })).toEqual({ ok: true })
    expect(acquireLock({ sessionId: 'cef-2', chatId: 'chat-b' })).toEqual({ ok: true })

    takeControl('cef-1')

    expect(assertLockedBy({ sessionId: 'cef-1', chatId: 'chat-a' }).ok).toBe(false)
    expect(assertLockedBy({ sessionId: 'cef-2', chatId: 'chat-b' }).ok).toBe(true)
    expect(acquireLock({ sessionId: 'cef-1', chatId: 'chat-c' })).toEqual({ ok: true })
  })

  it('allows takeover after lease expiry', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

    const { registerCefSession, acquireLock } = await import('@/services/browser/registry')

    registerCefSession({ sessionId: 'cef-1', workspaceId: 'ws-1' })
    expect(
      acquireLock({
        sessionId: 'cef-1',
        chatId: 'chat-a',
        leaseMs: 1_000,
      }),
    ).toEqual({ ok: true })

    vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'))

    expect(acquireLock({ sessionId: 'cef-1', chatId: 'chat-b' })).toEqual({ ok: true })
  })

  it('upserts, lists, removes tabs and tracks lastInteractedViewId', async () => {
    const {
      upsertTab,
      listTabs,
      removeTab,
      setLastInteractedViewId,
      getLastInteractedViewId,
    } = await import('@/services/browser/registry')

    const tabA: BrowserTab = {
      viewId: 'cef-a',
      workspaceId: 'ws-1',
      url: 'https://example.com/a',
      title: 'A',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const tabB: BrowserTab = {
      viewId: 'cef-b',
      workspaceId: 'ws-1',
      url: 'https://example.com/b',
      title: null,
      createdAt: '2026-01-01T00:00:01.000Z',
    }

    upsertTab('ws-1', tabA)
    upsertTab('ws-1', tabB)
    setLastInteractedViewId('ws-1', 'cef-a')

    expect(listTabs('ws-1')).toEqual([tabA, tabB])
    expect(getLastInteractedViewId('ws-1')).toBe('cef-a')

    upsertTab('ws-1', { ...tabA, title: 'A updated', url: 'https://example.com/a2' })
    expect(listTabs('ws-1')).toEqual([
      { ...tabA, title: 'A updated', url: 'https://example.com/a2' },
      tabB,
    ])

    removeTab('ws-1', 'cef-a')
    expect(listTabs('ws-1')).toEqual([tabB])
    expect(getLastInteractedViewId('ws-1')).toBe('cef-b')
  })

  it('acquireSession returns a CDP client for the session', async () => {
    const { registerCefSession, acquireSession } = await import(
      '@/services/browser/registry'
    )

    registerCefSession({ sessionId: 'cef-1', workspaceId: 'ws-1' })
    const result = await acquireSession({ sessionId: 'cef-1', chatId: 'chat-a' })
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.client).toBeTruthy()
    expect(browserCefGetCdpWsUrl).toHaveBeenCalledWith('cef-1')
    expect(connectWsUrl).toHaveBeenCalled()
  })

  it('reset clears all registry state', async () => {
    const {
      registerCefSession,
      acquireLock,
      upsertTab,
      setLastInteractedViewId,
      resetBrowserRegistryForTests,
      listTabs,
      getLastInteractedViewId,
      browserRegistryRevision,
    } = await import('@/services/browser/registry')

    registerCefSession({ sessionId: 'cef-1', workspaceId: 'ws-1' })
    expect(acquireLock({ sessionId: 'cef-1', chatId: 'chat-a' })).toEqual({ ok: true })
    upsertTab('ws-1', {
      viewId: 'cef-1',
      workspaceId: 'ws-1',
      url: 'https://example.com',
      title: 'Example',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    setLastInteractedViewId('ws-1', 'cef-1')
    expect(browserRegistryRevision.value).toBeGreaterThan(0)

    resetBrowserRegistryForTests()

    expect(listTabs('ws-1')).toEqual([])
    expect(getLastInteractedViewId('ws-1')).toBeNull()
    expect(browserRegistryRevision.value).toBe(0)
  })
})
