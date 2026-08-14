import type { BrowserLockCancelReason } from '@/types/browser/lock-cancel-reason'
import type { BrowserLockWaiter } from '@/types/browser/lock-waiter'
import type { AcquireLockResult } from '@/services/browser/session-lock'

export type ParkedLockWaiter = BrowserLockWaiter & {
  resolve: (result: AcquireLockResult) => void
  signal?: AbortSignal
  onAbort?: () => void
}

export const publicWaiters = (waiters: ParkedLockWaiter[]): BrowserLockWaiter[] =>
  waiters.map(({ chatId, subagentId, enqueuedAt }) => ({
    chatId,
    subagentId,
    enqueuedAt,
  }))

export const detachWaiter = (waiter: ParkedLockWaiter): void => {
  if (waiter.signal && waiter.onAbort) {
    waiter.signal.removeEventListener('abort', waiter.onAbort)
  }
}

export const settleWaiter = (
  waiter: ParkedLockWaiter,
  result: AcquireLockResult,
): void => {
  detachWaiter(waiter)
  waiter.resolve(result)
}

export const cancelWaiters = (
  waiters: ParkedLockWaiter[],
  cancelled: BrowserLockCancelReason,
): void => {
  const pending = waiters.splice(0, waiters.length)
  for (const waiter of pending) {
    settleWaiter(waiter, {
      ok: false,
      error: 'browser_lock_cancelled',
      cancelled,
    })
  }
}

export const cancelWaitersForChat = (
  waiters: ParkedLockWaiter[],
  chatId: string,
  cancelled: BrowserLockCancelReason,
): void => {
  const keep: ParkedLockWaiter[] = []
  for (const waiter of waiters) {
    if (waiter.chatId === chatId) {
      settleWaiter(waiter, {
        ok: false,
        error: 'browser_lock_cancelled',
        cancelled,
      })
    } else {
      keep.push(waiter)
    }
  }
  waiters.splice(0, waiters.length, ...keep)
}

export const takeGrantedWaiters = (
  waiters: ParkedLockWaiter[],
): ParkedLockWaiter[] => {
  const next = waiters[0]
  if (!next) {
    return []
  }
  const granted = waiters.filter((waiter) => waiter.chatId === next.chatId)
  const remaining = waiters.filter((waiter) => waiter.chatId !== next.chatId)
  waiters.splice(0, waiters.length, ...remaining)
  return granted
}
