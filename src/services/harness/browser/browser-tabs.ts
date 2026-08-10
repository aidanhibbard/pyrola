import { tool } from 'ai'
import { z } from 'zod'
import {
  listTabs,
  setLastInteractedViewId,
} from '@/services/browser/registry'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const browserTabs = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'List or select CEF browser sessions (workbench Browser tabs) for this project. list needs no lock. select requires an active lock on that session. Opening/closing native CEF views is done in the workbench UI (agent create/close deferred).',
      [{ action: 'list' }, { action: 'select', session_id: 'CEF_SESSION_ID' }],
    ),
    inputSchema: z.object({
      action: z.enum(['list', 'select']).describe('Tab action'),
      session_id: z
        .string()
        .optional()
        .describe('CEF session id for select'),
      viewId: z
        .string()
        .optional()
        .describe('Legacy alias for session_id'),
      url: z.string().optional().describe('Ignored (legacy; open tabs in the workbench)'),
    }),
    execute: async ({ action, session_id, viewId }, { toolCallId }) => {
      if (action !== 'list') {
        const allowed = await gateToolPermission({
          ctx: toPermCtx(ctx),
          toolCallId,
          name: 'browser_tabs',
          kind: 'browser',
          action: 'browser.interact',
          capability: 'browser.interact',
          title: `Browser tabs: ${action}`,
        })
        if (!allowed) {
          return { rejected: true, error: 'Browser access denied' }
        }
      }

      if (action === 'list') {
        const tabs = listTabs(ctx.projectSlug)
        return { tabs }
      }

      const targetId = pickBrowserSessionId({ session_id, viewId })
      if (!targetId) {
        return { error: 'session_id is required for action=select' }
      }

      const prepared = await prepareBrowserContext(ctx, {
        sessionId: targetId,
        requireLock: true,
      })
      if (!prepared.ok) {
        return prepared.result
      }
      const { browser } = prepared

      const session = await resolveBrowserSession(browser)
      if (!session.ok) {
        return session.result
      }

      setLastInteractedViewId(browser.workspaceId, session.viewId)
      const existing = listTabs(browser.workspaceId).find(
        (tab) => tab.viewId === session.viewId,
      )
      return {
        viewId: session.viewId,
        session_id: session.viewId,
        sessionId: session.sessionId,
        tab: existing ?? null,
      }
    },
  })

export default browserTabs
