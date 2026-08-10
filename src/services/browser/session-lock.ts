import type { BrowserLock } from '@/types/browser/browser-lock'

const DEFAULT_LEASE_MS = 5 * 60 * 1000

export type AcquireLockOk = { ok: true }
export type AcquireLockDenied = {
  ok: false
  error: 'browser_locked'
  ownerChatId: string
  leaseExpiresAt: number
}
export type AcquireLockResult = AcquireLockOk | AcquireLockDenied

export type AssertLockedOk = { ok: true }
export type AssertLockedDenied = {
  ok: false
  error: 'browser_locked'
  ownerChatId: string
}
export type AssertLockedResult = AssertLockedOk | AssertLockedDenied

export const isLockActive = (lock: BrowserLock | null): lock is BrowserLock => {
  if (!lock) {
    return false
  }
  return lock.leaseExpiresAt > Date.now()
}

export const resolveLeaseMs = (leaseMs?: number): number => {
  if (typeof leaseMs === 'number' && Number.isFinite(leaseMs) && leaseMs > 0) {
    return leaseMs
  }
  return DEFAULT_LEASE_MS
}

export const buildLock = (args: {
  sessionId: string
  workspaceId: string
  chatId: string
  subagentId?: string
  leaseMs?: number
}): BrowserLock => ({
  sessionId: args.sessionId,
  workspaceId: args.workspaceId,
  ownerChatId: args.chatId,
  ownerSubagentId: args.subagentId ?? null,
  leaseExpiresAt: Date.now() + resolveLeaseMs(args.leaseMs),
  viewId: args.sessionId,
})
