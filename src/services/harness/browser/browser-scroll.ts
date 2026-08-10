import { tool } from 'ai'
import { z } from 'zod'
import { scroll } from '@/services/browser/cdp-ops'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const browserScroll = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Scroll the page or scroll an element into view by snapshot ref.',
      [{ deltaY: 400 }, { ref: 'e20' }],
    ),
    inputSchema: z.object({
      deltaX: z.number().optional().describe('Horizontal scroll delta'),
      deltaY: z.number().optional().describe('Vertical scroll delta'),
      ref: z
        .string()
        .optional()
        .describe('If set, scroll this element into view before applying deltas'),
      session_id: z
        .string()
        .optional()
        .describe('CEF session id; defaults to last interacted'),
      viewId: z
        .string()
        .optional()
        .describe('Legacy alias for session_id'),
    }),
    execute: async ({ deltaX, deltaY, ref, session_id, viewId }, { toolCallId }) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'browser_scroll',
        kind: 'browser',
        action: 'browser.interact',
        capability: 'browser.interact',
        title: 'Browser scroll',
      })
      if (!allowed) {
        return { rejected: true, error: 'Browser access denied' }
      }

      const prepared = await prepareBrowserContext(ctx, {
        sessionId: pickBrowserSessionId({ session_id, viewId }),
      })
      if (!prepared.ok) {
        return prepared.result
      }

      const session = await resolveBrowserSession(prepared.browser)
      if (!session.ok) {
        return session.result
      }

      await scroll(prepared.browser.client, session.sessionId, {
        deltaX,
        deltaY,
        ref,
      })
      return { ok: true, viewId: session.viewId }
    },
  })

export default browserScroll
