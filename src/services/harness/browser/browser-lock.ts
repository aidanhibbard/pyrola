import { tool } from 'ai'
import { z } from 'zod'
import {
  acquireLock,
  releaseLock,
  resolveSessionIdForWorkspace,
} from '@/services/browser/registry'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const browserLock = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Acquire or release an exclusive lock on a CEF browser session for this chat. Lock before interacting. Unlock when finished so other chats can take over the same session. Different sessions do not contend.',
      [
        { action: 'lock' },
        { action: 'lock', session_id: 'CEF_SESSION_ID' },
        { action: 'unlock' },
      ],
    ),
    inputSchema: z.object({
      action: z.enum(['lock', 'unlock']).describe('Lock or unlock the CEF session'),
      session_id: z
        .string()
        .optional()
        .describe('CEF session id; defaults to last interacted for this project'),
      viewId: z
        .string()
        .optional()
        .describe('Legacy alias for session_id'),
      leaseMs: z
        .number()
        .optional()
        .describe('Optional lease duration in ms when action=lock'),
    }),
    execute: async ({ action, session_id, viewId, leaseMs }, { toolCallId }) => {
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
      )
      if (!sessionId) {
        return {
          error:
            'No CEF browser session. Open a Browser tab in the workbench, then pass session_id.',
        }
      }

      if (action === 'lock') {
        try {
          const acquired = acquireLock({
            sessionId,
            workspaceId,
            chatId: ctx.chatId,
            subagentId: ctx.subagentId,
            leaseMs,
          })
          if (!acquired.ok) {
            return {
              error: 'browser_locked',
              ownerChatId: acquired.ownerChatId,
              leaseExpiresAt: acquired.leaseExpiresAt,
            }
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
