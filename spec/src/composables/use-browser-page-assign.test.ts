import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { toast } from 'vue-sonner'
import useBrowserPageAssign from '@/composables/use-browser-page-assign'
import type { BrowserLock } from '@/types/browser/browser-lock'
import type { FleetSidebarChat } from '@/types/fleet/fleet-sidebar-chat'

const getPreferredChatIdForSession = vi.hoisted(
  () =>
    vi.fn<(workspaceId: string, sessionId: string) => string | null>(
      () => null,
    ),
)
const getSessionLock = vi.hoisted(
  () => vi.fn<(sessionId: string) => BrowserLock | null>(() => null),
)
const takeControl = vi.hoisted(() => vi.fn<(sessionId: string) => void>())
const assignExclusivePreferredSession = vi.hoisted(
  () => vi.fn<(chatId: string, sessionId: string) => void>(),
)
const refreshSlug = vi.hoisted(
  () => vi.fn<(slug: string) => Promise<void>>(),
)
const chatTitleForId = vi.hoisted(
  () => vi.fn<(chatId: string) => string | null>(() => null),
)

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
  },
}))

vi.mock('@/composables/use-fleet-sidebar', () => ({
  default: () => ({
    standaloneChats: { value: [] },
    sidebarProjects: {
      value: [
        {
          slug: 'ws',
          chats: [
            { id: 'chat-a', title: 'Alpha' },
            { id: 'chat-b', title: 'Beta' },
          ] satisfies FleetSidebarChat[],
        },
      ],
    },
    refreshSlug: (slug: string) => refreshSlug(slug),
  }),
  chatTitleForId: (chatId: string) => chatTitleForId(chatId),
}))

vi.mock('@/services/browser/registry', () => ({
  browserRegistryRevision: { value: 1 },
  getPreferredChatIdForSession: (workspaceId: string, sessionId: string) =>
    getPreferredChatIdForSession(workspaceId, sessionId),
  getSessionLock: (sessionId: string) => getSessionLock(sessionId),
  takeControl: (sessionId: string) => takeControl(sessionId),
  assignExclusivePreferredSession: (chatId: string, sessionId: string) =>
    assignExclusivePreferredSession(chatId, sessionId),
}))

describe('use-browser-page-assign', () => {
  let scope: ReturnType<typeof effectScope> | null = null
  const preferred = ref<string | null>('chat-a')

  beforeEach(() => {
    preferred.value = 'chat-a'
    getPreferredChatIdForSession.mockReset()
    getSessionLock.mockReset()
    takeControl.mockReset()
    assignExclusivePreferredSession.mockReset()
    refreshSlug.mockReset()
    chatTitleForId.mockReset()
    getPreferredChatIdForSession.mockImplementation(() => preferred.value)
    getSessionLock.mockReturnValue(null)
    chatTitleForId.mockImplementation((id) =>
      id === 'chat-a' ? 'Alpha' : id === 'chat-b' ? 'Beta' : null,
    )
    refreshSlug.mockResolvedValue(undefined)
  })

  afterEach(() => {
    scope?.stop()
    scope = null
  })

  const run = () => {
    scope = effectScope()
    const api = scope.run(() => useBrowserPageAssign('ws'))
    if (!api) {
      throw new Error('failed to create assign api')
    }
    return api
  }

  it('ignores assign when the chat already owns the page', () => {
    const api = run()
    api.assignToChat('chat-a', '1')
    expect(assignExclusivePreferredSession).not.toHaveBeenCalled()
    expect(api.pendingMove.value).toBeNull()
  })

  it('assigns immediately when the page is not locked', () => {
    const api = run()
    api.assignToChat('chat-b', '1')
    expect(assignExclusivePreferredSession).toHaveBeenCalledWith('chat-b', '1')
    expect(takeControl).not.toHaveBeenCalled()
    expect(api.pendingMove.value).toBeNull()
  })

  it('opens confirm when another chat holds the lock', () => {
    getSessionLock.mockReturnValue({
      sessionId: '1',
      workspaceId: 'ws',
      ownerChatId: 'chat-a',
      ownerSubagentId: null,
      viewId: '1',
    })
    const api = run()
    api.assignToChat('chat-b', '1')
    expect(assignExclusivePreferredSession).not.toHaveBeenCalled()
    expect(api.pendingMove.value).toEqual({
      sessionId: '1',
      targetChatId: 'chat-b',
      ownerTitle: 'Alpha',
      targetTitle: 'Beta',
    })
  })

  it('take control then rebinds on confirm', () => {
    getSessionLock.mockReturnValue({
      sessionId: '1',
      workspaceId: 'ws',
      ownerChatId: 'chat-a',
      ownerSubagentId: null,
      viewId: '1',
    })
    const api = run()
    api.assignToChat('chat-b', '1')
    api.confirmPendingMove()
    expect(takeControl).toHaveBeenCalledWith('1')
    expect(assignExclusivePreferredSession).toHaveBeenCalledWith('chat-b', '1')
    expect(toast.success).toHaveBeenCalled()
    expect(api.pendingMove.value).toBeNull()
  })
})
