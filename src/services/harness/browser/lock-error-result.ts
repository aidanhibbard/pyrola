import { chatTitleForId } from '@/composables/use-fleet-sidebar'
import type { AcquireLockResult } from '@/services/browser/session-lock'

const lockErrorResult = (
  acquired: Exclude<AcquireLockResult, { ok: true }>,
): Record<string, unknown> => {
  if (acquired.error === 'browser_locked') {
    return {
      error: 'browser_locked',
      ownerChatId: acquired.ownerChatId,
      ownerTitle: chatTitleForId(acquired.ownerChatId),
      queueLength: acquired.queueLength,
    }
  }
  return {
    error: 'browser_lock_cancelled',
    cancelled: acquired.cancelled,
  }
}

export default lockErrorResult
