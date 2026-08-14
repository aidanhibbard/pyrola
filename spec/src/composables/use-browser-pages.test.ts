import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import useBrowserPages from '@/composables/use-browser-pages'
import type { BrowserTab } from '@/types/browser/browser-tab'

const destroyCefSession = vi.hoisted(
  () => vi.fn<(sessionId: string) => Promise<void>>(),
)
const createCefSession = vi.hoisted(
  () => vi.fn<(workspaceId: string) => Promise<string>>(),
)
const listTabs = vi.hoisted(() => vi.fn<(workspaceId: string) => BrowserTab[]>())
const setLastInteractedViewId = vi.hoisted(
  () => vi.fn<(workspaceId: string, viewId: string) => void>(),
)
const getLastInteractedViewId = vi.hoisted(
  () => vi.fn<(workspaceId: string) => string | null>(() => null),
)

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
  },
}))

vi.mock('@/services/browser/destroy-cef-session', () => ({
  default: (sessionId: string) => destroyCefSession(sessionId),
}))

vi.mock('@/services/browser/create-cef-session', () => ({
  default: (workspaceId: string) => createCefSession(workspaceId),
}))

vi.mock('@/services/browser/registry', () => ({
  browserRegistryRevision: { value: 1 },
  listTabs: (workspaceId: string) => listTabs(workspaceId),
  setLastInteractedViewId: (workspaceId: string, viewId: string) =>
    setLastInteractedViewId(workspaceId, viewId),
  getLastInteractedViewId: (workspaceId: string) =>
    getLastInteractedViewId(workspaceId),
}))

describe('use-browser-pages', () => {
  let scope: ReturnType<typeof effectScope> | null = null
  let activeId: string | null
  const switchToSession = vi.fn<(sessionId: string) => Promise<void>>()
  const detachActiveSession = vi.fn<() => Promise<void>>()

  const tab = (viewId: string): BrowserTab => ({
    viewId,
    workspaceId: 'ws',
    url: 'https://example.com',
    title: viewId,
    createdAt: '2026-01-01T00:00:00.000Z',
  })

  beforeEach(() => {
    activeId = '1'
    destroyCefSession.mockReset()
    createCefSession.mockReset()
    listTabs.mockReset()
    setLastInteractedViewId.mockReset()
    getLastInteractedViewId.mockReset()
    switchToSession.mockReset()
    detachActiveSession.mockReset()
    destroyCefSession.mockResolvedValue(undefined)
    switchToSession.mockResolvedValue(undefined)
    detachActiveSession.mockResolvedValue(undefined)
    getLastInteractedViewId.mockReturnValue(null)
  })

  afterEach(() => {
    scope?.stop()
    scope = null
  })

  const runClose = async (sessionId: string): Promise<string[]> => {
    const order: string[] = []
    detachActiveSession.mockImplementation(async () => {
      order.push('detach')
      activeId = null
    })
    destroyCefSession.mockImplementation(async (id) => {
      order.push(`destroy:${id}`)
    })
    switchToSession.mockImplementation(async (id) => {
      order.push(`switch:${id}`)
    })
    scope = effectScope()
    const pages = scope.run(() =>
      useBrowserPages({
        workspaceId: 'ws',
        getActiveSessionId: () => activeId,
        switchToSession,
        detachActiveSession,
      }),
    )
    if (!pages) {
      throw new Error('failed to create pages')
    }
    await pages.closePage(sessionId)
    return order
  }

  it('detaches the active session before native destroy', async () => {
    listTabs.mockReturnValue([])
    const order = await runClose('1')
    expect(order).toEqual(['detach', 'destroy:1', 'switch:'])
    expect(detachActiveSession).toHaveBeenCalledTimes(1)
  })

  it('switches to a remaining page after closing the active session', async () => {
    listTabs.mockReturnValue([tab('2')])
    const order = await runClose('1')
    expect(order).toEqual(['detach', 'destroy:1', 'switch:2'])
    expect(setLastInteractedViewId).toHaveBeenCalledWith('ws', '2')
  })

  it('does not detach when closing a background page', async () => {
    listTabs.mockReturnValue([tab('1')])
    const order = await runClose('2')
    expect(order).toEqual(['destroy:2', 'switch:1'])
    expect(detachActiveSession).not.toHaveBeenCalled()
  })

  it('opens a new page after the last page is closed', async () => {
    listTabs.mockReturnValue([])
    createCefSession.mockResolvedValue('9')
    scope = effectScope()
    const pages = scope.run(() =>
      useBrowserPages({
        workspaceId: 'ws',
        getActiveSessionId: () => activeId,
        switchToSession,
        detachActiveSession,
      }),
    )
    if (!pages) {
      throw new Error('failed to create pages')
    }
    await pages.closePage('1')
    await pages.addPage()
    expect(createCefSession).toHaveBeenCalledWith('ws')
    expect(switchToSession).toHaveBeenLastCalledWith('9')
  })
})
