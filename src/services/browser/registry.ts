import { ref } from 'vue'
import resolveCefCdpClient, {
  dropCefCdpClient,
  resetCefCdpClientsForTests,
} from '@/services/browser/resolve-cef-cdp-client'
import {
  buildLock,
  isLockActive,
  type AcquireLockResult,
  type AssertLockedResult,
} from '@/services/browser/session-lock'
import type CdpClient from '@/services/browser/cdp-client'
import type { BrowserLock } from '@/types/browser/browser-lock'
import type { BrowserTab } from '@/types/browser/browser-tab'

type WorkspaceIndex = {
  workspaceId: string
  sessionIds: Set<string>
  lastInteractedSessionId: string | null
}

type CefSessionEntry = {
  sessionId: string
  workspaceId: string
  lock: BrowserLock | null
  tab: BrowserTab
}

type AcquireSessionOk = { ok: true; client: CdpClient }
type AcquireSessionResult = AcquireSessionOk | Exclude<AcquireLockResult, { ok: true }>

const workspaces = new Map<string, WorkspaceIndex>()
const cefSessions = new Map<string, CefSessionEntry>()

export const browserRegistryRevision = ref(0)

const bumpRevision = (): void => {
  browserRegistryRevision.value++
}

const clearExpiredLock = (entry: CefSessionEntry): void => {
  if (entry.lock && !isLockActive(entry.lock)) {
    entry.lock = null
  }
}

const getOrCreateWorkspace = (workspaceId: string): WorkspaceIndex => {
  const existing = workspaces.get(workspaceId)
  if (existing) {
    return existing
  }
  const index: WorkspaceIndex = {
    workspaceId,
    sessionIds: new Set(),
    lastInteractedSessionId: null,
  }
  workspaces.set(workspaceId, index)
  return index
}

const requireEntry = (sessionId: string): CefSessionEntry => {
  const entry = cefSessions.get(sessionId)
  if (!entry) {
    throw new Error(
      `Unknown CEF session: ${sessionId}. Open a Browser tab in the workbench first.`,
    )
  }
  return entry
}

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
  cefSessions.delete(sessionId)
  dropCefCdpClient(sessionId)

  const index = workspaces.get(entry.workspaceId)
  if (index) {
    index.sessionIds.delete(sessionId)
    if (index.lastInteractedSessionId === sessionId) {
      const next = index.sessionIds.values().next()
      index.lastInteractedSessionId = next.done ? null : next.value
    }
  }
  bumpRevision()
}

export const getSessionCdpClient = async (sessionId: string): Promise<CdpClient> => {
  requireEntry(sessionId)
  return resolveCefCdpClient(sessionId)
}

export const acquireSession = async (args: {
  sessionId: string
  chatId: string
  subagentId?: string
  leaseMs?: number
}): Promise<AcquireSessionResult> => {
  const locked = acquireLock(args)
  if (!locked.ok) {
    return locked
  }
  const client = await resolveCefCdpClient(args.sessionId)
  return { ok: true, client }
}

export const acquireLock = (args: {
  sessionId: string
  workspaceId?: string
  chatId: string
  subagentId?: string
  leaseMs?: number
}): AcquireLockResult => {
  const entry = requireEntry(args.sessionId)
  clearExpiredLock(entry)

  if (isLockActive(entry.lock) && entry.lock.ownerChatId !== args.chatId) {
    return {
      ok: false,
      error: 'browser_locked',
      ownerChatId: entry.lock.ownerChatId,
      leaseExpiresAt: entry.lock.leaseExpiresAt,
    }
  }

  entry.lock = buildLock({
    sessionId: args.sessionId,
    workspaceId: entry.workspaceId,
    chatId: args.chatId,
    subagentId: args.subagentId,
    leaseMs: args.leaseMs,
  })
  bumpRevision()
  return { ok: true }
}

export const releaseSession = (args: { sessionId: string; chatId: string }): void => {
  const entry = cefSessions.get(args.sessionId)
  if (!entry) {
    return
  }
  clearExpiredLock(entry)
  if (!entry.lock || entry.lock.ownerChatId !== args.chatId) {
    return
  }
  entry.lock = null
  bumpRevision()
}

export const releaseLock = (args: { sessionId: string; chatId: string }): void => {
  releaseSession(args)
}

export const takeControl = (sessionId: string): void => {
  const entry = cefSessions.get(sessionId)
  if (!entry?.lock) {
    return
  }
  entry.lock = null
  bumpRevision()
}

export const assertLockedBy = (args: {
  sessionId: string
  chatId: string
}): AssertLockedResult => {
  const entry = cefSessions.get(args.sessionId)
  if (!entry) {
    return { ok: false, error: 'browser_locked', ownerChatId: '' }
  }
  clearExpiredLock(entry)

  if (!isLockActive(entry.lock)) {
    return { ok: false, error: 'browser_locked', ownerChatId: '' }
  }
  if (entry.lock.ownerChatId !== args.chatId) {
    return {
      ok: false,
      error: 'browser_locked',
      ownerChatId: entry.lock.ownerChatId,
    }
  }
  return { ok: true }
}

export const getSessionLock = (sessionId: string): BrowserLock | null => {
  const entry = cefSessions.get(sessionId)
  if (!entry) {
    return null
  }
  clearExpiredLock(entry)
  return entry.lock
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
): string | null => {
  if (sessionId && sessionId.trim()) {
    const trimmed = sessionId.trim()
    if (cefSessions.has(trimmed)) {
      return trimmed
    }
    return null
  }
  return getLastInteractedViewId(workspaceId)
}

export const resetBrowserRegistryForTests = (): void => {
  cefSessions.clear()
  workspaces.clear()
  resetCefCdpClientsForTests()
  browserRegistryRevision.value = 0
}
