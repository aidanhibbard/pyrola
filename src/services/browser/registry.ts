import resolveCefCdpClient, {
  dropCefCdpClient,
  resetCefCdpClientsForTests,
} from '@/services/browser/resolve-cef-cdp-client'
import {
  browserRegistryRevision,
  bumpRevision,
  cefSessions,
  getOrCreateWorkspace,
  requireEntry,
  resetCefStore,
  workspaces,
} from '@/services/browser/cef-store'
import {
  acquireLock,
  cancelSessionWaiters,
  type AcquireLockArgs,
} from '@/services/browser/lock-api'
import {
  dropPreferredForSession,
  getChatPreferredSession,
} from '@/services/browser/preferred-session'
import type CdpClient from '@/services/browser/cdp-client'
import type { BrowserTab } from '@/types/browser/browser-tab'
import type { AcquireLockResult } from '@/services/browser/session-lock'

type AcquireSessionOk = { ok: true; client: CdpClient }
type AcquireSessionResult = AcquireSessionOk | Exclude<AcquireLockResult, { ok: true }>

export { browserRegistryRevision }
export {
  acquireLock,
  assertLockedBy,
  getSessionLock,
  getSessionWaiters,
  releaseLock,
  releaseLocksForChat,
  releaseSession,
  takeControl,
} from '@/services/browser/lock-api'
export type { AcquireLockArgs } from '@/services/browser/lock-api'
export {
  assignExclusivePreferredSession,
  bindPreferredIfUnset,
  clearChatPreferredSession,
  dropPreferredForSession,
  getChatPreferredSession,
  getPreferredChatIdForSession,
  setChatPreferredSession,
} from '@/services/browser/preferred-session'

export const registerCefSession = (args: {
  sessionId: string
  workspaceId: string
  url?: string
  title?: string | null
}): void => {
  const { sessionId, workspaceId } = args
  const index = getOrCreateWorkspace(workspaceId)
  index.sessionIds.add(sessionId)

  const existing = cefSessions.get(sessionId)
  if (existing) {
    existing.tab = {
      ...existing.tab,
      url: args.url ?? existing.tab.url,
      title: args.title !== undefined ? args.title : existing.tab.title,
    }
    bumpRevision()
    return
  }

  cefSessions.set(sessionId, {
    sessionId,
    workspaceId,
    lock: null,
    waiters: [],
    tab: {
      viewId: sessionId,
      workspaceId,
      url: args.url ?? 'about:blank',
      title: args.title ?? null,
      createdAt: new Date().toISOString(),
    },
  })
  if (!index.lastInteractedSessionId) {
    index.lastInteractedSessionId = sessionId
  }
  bumpRevision()
}

export const unregisterCefSession = (sessionId: string): void => {
  const entry = cefSessions.get(sessionId)
  if (!entry) {
    return
  }
  cancelSessionWaiters(sessionId, 'session_destroyed')
  cefSessions.delete(sessionId)
  dropCefCdpClient(sessionId)

  const index = workspaces.get(entry.workspaceId)
  if (index) {
    index.sessionIds.delete(sessionId)
    if (index.lastInteractedSessionId === sessionId) {
      const next = index.sessionIds.values().next()
      index.lastInteractedSessionId = next.done ? null : next.value
    }
    dropPreferredForSession(entry.workspaceId, sessionId)
  }
  bumpRevision()
}

export const getSessionCdpClient = async (sessionId: string): Promise<CdpClient> => {
  requireEntry(sessionId)
  return resolveCefCdpClient(sessionId)
}

export const acquireSession = async (args: AcquireLockArgs): Promise<AcquireSessionResult> => {
  const locked = await acquireLock(args)
  if (!locked.ok) {
    return locked
  }
  const client = await resolveCefCdpClient(args.sessionId)
  return { ok: true, client }
}

export const listTabs = (workspaceId: string): BrowserTab[] => {
  const index = workspaces.get(workspaceId)
  if (!index) {
    return []
  }
  const tabs: BrowserTab[] = []
  for (const sessionId of index.sessionIds) {
    const entry = cefSessions.get(sessionId)
    if (entry) {
      tabs.push(entry.tab)
    }
  }
  return tabs
}

export const upsertTab = (workspaceId: string, tab: BrowserTab): void => {
  registerCefSession({
    sessionId: tab.viewId,
    workspaceId,
    url: tab.url,
    title: tab.title,
  })
  const entry = cefSessions.get(tab.viewId)
  if (entry) {
    entry.tab = { ...tab, workspaceId }
    bumpRevision()
  }
}

export const removeTab = (workspaceId: string, viewId: string): void => {
  const entry = cefSessions.get(viewId)
  if (!entry || entry.workspaceId !== workspaceId) {
    return
  }
  unregisterCefSession(viewId)
}

export const setLastInteractedViewId = (workspaceId: string, viewId: string): void => {
  const index = getOrCreateWorkspace(workspaceId)
  if (!index.sessionIds.has(viewId) && !cefSessions.has(viewId)) {
    return
  }
  index.sessionIds.add(viewId)
  index.lastInteractedSessionId = viewId
  bumpRevision()
}

export const getLastInteractedViewId = (workspaceId: string): string | null => {
  return workspaces.get(workspaceId)?.lastInteractedSessionId ?? null
}

export const resolveSessionIdForWorkspace = (
  workspaceId: string,
  sessionId?: string,
  chatId?: string,
): string | null => {
  if (sessionId && sessionId.trim()) {
    const trimmed = sessionId.trim()
    if (cefSessions.has(trimmed)) {
      return trimmed
    }
    return null
  }
  if (chatId) {
    const preferred = getChatPreferredSession(workspaceId, chatId)
    if (preferred) {
      return preferred
    }
  }
  return getLastInteractedViewId(workspaceId)
}

export const resetBrowserRegistryForTests = (): void => {
  for (const sessionId of cefSessions.keys()) {
    cancelSessionWaiters(sessionId, 'session_destroyed')
  }
  resetCefStore()
  resetCefCdpClientsForTests()
}
