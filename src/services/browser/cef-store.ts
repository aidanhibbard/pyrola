import { ref } from 'vue'
import type { ParkedLockWaiter } from '@/services/browser/lock-waiters'
import type { BrowserLock } from '@/types/browser/browser-lock'
import type { BrowserTab } from '@/types/browser/browser-tab'

export type WorkspaceIndex = {
  workspaceId: string
  sessionIds: Set<string>
  lastInteractedSessionId: string | null
  preferredSessionByChatId: Map<string, string>
}

export type CefSessionEntry = {
  sessionId: string
  workspaceId: string
  lock: BrowserLock | null
  waiters: ParkedLockWaiter[]
  tab: BrowserTab
}

export const workspaces = new Map<string, WorkspaceIndex>()
export const cefSessions = new Map<string, CefSessionEntry>()
export const browserRegistryRevision = ref(0)

export const bumpRevision = (): void => {
  browserRegistryRevision.value++
}

export const getOrCreateWorkspace = (workspaceId: string): WorkspaceIndex => {
  const existing = workspaces.get(workspaceId)
  if (existing) {
    return existing
  }
  const index: WorkspaceIndex = {
    workspaceId,
    sessionIds: new Set(),
    lastInteractedSessionId: null,
    preferredSessionByChatId: new Map(),
  }
  workspaces.set(workspaceId, index)
  return index
}

export const requireEntry = (sessionId: string): CefSessionEntry => {
  const entry = cefSessions.get(sessionId)
  if (!entry) {
    throw new Error(
      `Unknown CEF session: ${sessionId}. Open a Browser tab in the workbench first.`,
    )
  }
  return entry
}

export const resetCefStore = (): void => {
  cefSessions.clear()
  workspaces.clear()
  browserRegistryRevision.value = 0
}
