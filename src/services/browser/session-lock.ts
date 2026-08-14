import type { BrowserLock } from '@/types/browser/browser-lock'
import type { BrowserLockCancelReason } from '@/types/browser/lock-cancel-reason'

export type AcquireLockOk = { ok: true }
export type AcquireLockDenied = {
  ok: false
  error: 'browser_locked'
  ownerChatId: string
  ownerTitle: string | null
  queueLength: number
}
export type AcquireLockCancelled = {
  ok: false
  error: 'browser_lock_cancelled'
  cancelled: BrowserLockCancelReason
}
export type AcquireLockResult =
  | AcquireLockOk
  | AcquireLockDenied
  | AcquireLockCancelled

export type AssertLockedOk = { ok: true }
export type AssertLockedDenied = {
  ok: false
  error: 'browser_locked'
  ownerChatId: string
}
export type AssertLockedResult = AssertLockedOk | AssertLockedDenied

export const isLockActive = (lock: BrowserLock | null): lock is BrowserLock =>
  lock !== null

export const buildLock = (args: {
  sessionId: string
  workspaceId: string
  chatId: string
  subagentId?: string | null
}): BrowserLock => ({
  sessionId: args.sessionId,
  workspaceId: args.workspaceId,
  ownerChatId: args.chatId,
  ownerSubagentId: args.subagentId ?? null,
  viewId: args.sessionId,
})
