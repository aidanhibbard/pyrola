import {
  cancelWaiters,
  cancelWaitersForChat,
  publicWaiters,
  settleWaiter,
  takeGrantedWaiters,
  type ParkedLockWaiter,
} from '@/services/browser/lock-waiters'
import {
  bumpRevision,
  cefSessions,
  requireEntry,
  type CefSessionEntry,
} from '@/services/browser/cef-store'
import {
  bindPreferredIfUnset,
  clearChatPreferredSession,
} from '@/services/browser/preferred-session'
import {
  buildLock,
  isLockActive,
  type AcquireLockResult,
  type AssertLockedResult,
} from '@/services/browser/session-lock'
import type { BrowserLock } from '@/types/browser/browser-lock'
import type { BrowserLockCancelReason } from '@/types/browser/lock-cancel-reason'
import type { BrowserLockWaiter } from '@/types/browser/lock-waiter'

export type AcquireLockArgs = {
  sessionId: string
  workspaceId?: string
  chatId: string
  subagentId?: string
  wait?: boolean
  signal?: AbortSignal
}

const deniedLocked = (entry: CefSessionEntry): AcquireLockResult => ({
  ok: false,
  error: 'browser_locked',
  ownerChatId: entry.lock?.ownerChatId ?? '',
  ownerTitle: null,
  queueLength: entry.waiters.length,
})

const assignLock = (
  entry: CefSessionEntry,
  chatId: string,
  subagentId?: string | null,
): void => {
  entry.lock = buildLock({
    sessionId: entry.sessionId,
    workspaceId: entry.workspaceId,
    chatId,
    subagentId,
  })
}

const grantNextWaiter = (entry: CefSessionEntry): void => {
  const granted = takeGrantedWaiters(entry.waiters)
  const next = granted[0]
  if (!next) {
    entry.lock = null
    bumpRevision()
    return
  }
  assignLock(entry, next.chatId, next.subagentId)
  bindPreferredIfUnset({
    workspaceId: entry.workspaceId,
    chatId: next.chatId,
    sessionId: entry.sessionId,
  })
  for (const waiter of granted) {
    settleWaiter(waiter, { ok: true })
  }
  bumpRevision()
}

const parkWaiter = (
  entry: CefSessionEntry,
  args: AcquireLockArgs,
): Promise<AcquireLockResult> =>
  new Promise((resolve) => {
    const waiter: ParkedLockWaiter = {
      chatId: args.chatId,
      subagentId: args.subagentId ?? null,
      enqueuedAt: Date.now(),
      resolve,
      signal: args.signal,
    }
    const onAbort = (): void => {
      const index = entry.waiters.indexOf(waiter)
      if (index < 0) {
        return
      }
      entry.waiters.splice(index, 1)
      settleWaiter(waiter, {
        ok: false,
        error: 'browser_lock_cancelled',
        cancelled: 'aborted',
      })
      bumpRevision()
    }
    if (args.signal) {
      waiter.onAbort = onAbort
      args.signal.addEventListener('abort', onAbort, { once: true })
    }
    entry.waiters.push(waiter)
    bumpRevision()
  })

export const acquireLock = async (args: AcquireLockArgs): Promise<AcquireLockResult> => {
  const entry = requireEntry(args.sessionId)
  const wait = args.wait === true

  if (args.signal?.aborted) {
    return { ok: false, error: 'browser_lock_cancelled', cancelled: 'aborted' }
  }

  if (!isLockActive(entry.lock) || entry.lock.ownerChatId === args.chatId) {
    assignLock(entry, args.chatId, args.subagentId)
    bindPreferredIfUnset({
      workspaceId: entry.workspaceId,
      chatId: args.chatId,
      sessionId: entry.sessionId,
    })
    bumpRevision()
    return { ok: true }
  }

  if (!wait) {
    return deniedLocked(entry)
  }

  return parkWaiter(entry, args)
}

export const releaseSession = (args: { sessionId: string; chatId: string }): void => {
  const entry = cefSessions.get(args.sessionId)
  if (!entry) {
    return
  }
  if (!entry.lock || entry.lock.ownerChatId !== args.chatId) {
    return
  }
  grantNextWaiter(entry)
}

export const releaseLock = (args: { sessionId: string; chatId: string }): void => {
  releaseSession(args)
}

export const takeControl = (sessionId: string): void => {
  const entry = cefSessions.get(sessionId)
  if (!entry) {
    return
  }
  entry.lock = null
  cancelWaiters(entry.waiters, 'user_took_control')
  bumpRevision()
}

export const releaseLocksForChat = (
  chatId: string,
  cancelled: Extract<
    BrowserLockCancelReason,
    'aborted' | 'chat_deleted' | 'run_complete'
  > = 'aborted',
): void => {
  if (cancelled === 'chat_deleted') {
    clearChatPreferredSession(chatId)
  }
  for (const entry of cefSessions.values()) {
    cancelWaitersForChat(entry.waiters, chatId, cancelled)
    if (entry.lock?.ownerChatId === chatId) {
      grantNextWaiter(entry)
    } else {
      bumpRevision()
    }
  }
}

export const assertLockedBy = (args: {
  sessionId: string
  chatId: string
}): AssertLockedResult => {
  const entry = cefSessions.get(args.sessionId)
  if (!entry) {
    return { ok: false, error: 'browser_locked', ownerChatId: '' }
  }

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
  return cefSessions.get(sessionId)?.lock ?? null
}

export const getSessionWaiters = (sessionId: string): BrowserLockWaiter[] => {
  const entry = cefSessions.get(sessionId)
  if (!entry) {
    return []
  }
  return publicWaiters(entry.waiters)
}

export const cancelSessionWaiters = (
  sessionId: string,
  cancelled: BrowserLockCancelReason,
): void => {
  const entry = cefSessions.get(sessionId)
  if (!entry) {
    return
  }
  cancelWaiters(entry.waiters, cancelled)
}
