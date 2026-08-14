import { tool } from 'ai'
import { z } from 'zod'
import {
  acquireLock,
  releaseLock,
  resolveSessionIdForWorkspace,
} from '@/services/browser/registry'
import lockErrorResult from '@/services/harness/browser/lock-error-result'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const browserLock = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Acquire an exclusive lock on a CEF session for this chat. After browser_tabs list, lock that session_id when you need wait or a specific session. The harness holds the lock for this run and releases it when the run ends (or the user Takes Control / Stop). Do not unlock. wait:true queues FIFO. wait:false (default) bails with browser_locked. Same chat (including subagents) may re-acquire. Different sessions do not contend. If no session exists, browser_tabs new or browser_navigate may open the workbench browser.',
      [
        { action: 'lock' },
        { action: 'lock', wait: true },
        { action: 'lock', session_id: 'CEF_SESSION_ID' },
      ],
    ),
    inputSchema: z.object({
      action: z.enum(['lock', 'unlock']).describe('Lock or unlock the CEF session'),
      session_id: z
        .string()
        .optional()
        .describe('CEF session id; defaults to this chat preferred session, else last interacted'),
      viewId: z
        .string()
        .optional()
        .describe('Legacy alias for session_id'),
      wait: z
        .boolean()
        .optional()
        .describe(
          'When action=lock, wait:true queues FIFO until granted; wait:false (default) bails with browser_locked',
        ),
    }),
    execute: async ({ action, session_id, viewId, wait }, { toolCallId }) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'browser_lock',
        kind: 'browser',
        action: 'browser.interact',
        capability: 'browser.interact',
        title: `Browser ${action}`,
      })
      if (!allowed) {
        return { rejected: true, error: 'Browser access denied' }
      }

      const workspaceId = ctx.projectSlug
      const sessionId = resolveSessionIdForWorkspace(
        workspaceId,
        session_id ?? viewId,
        ctx.chatId,
      )
      if (!sessionId) {
        return {
          error:
            'No CEF browser session. Use browser_tabs action new or browser_navigate to open one, then pass session_id.',
        }
      }

      if (action === 'lock') {
        try {
          const acquired = await acquireLock({
            sessionId,
            workspaceId,
            chatId: ctx.chatId,
            subagentId: ctx.subagentId,
            wait: wait === true,
            signal: ctx.signal,
          })
          if (!acquired.ok) {
            return lockErrorResult(acquired)
          }
          return { locked: true, workspaceId, session_id: sessionId, viewId: sessionId }
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Failed to acquire lock',
          }
        }
      }

      releaseLock({ sessionId, chatId: ctx.chatId })
      return { locked: false, workspaceId, session_id: sessionId, viewId: sessionId }
    },
  })

export default browserLock
