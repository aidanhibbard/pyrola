import { tool } from 'ai'
import { z } from 'zod'
import { click } from '@/services/browser/cdp-ops'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const browserClick = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Click an element in the shared browser by snapshot ref.',
      [{ ref: 'e12' }, { ref: 'e12', doubleClick: true, button: 'left' }],
    ),
    inputSchema: z.object({
      ref: z.string().describe('Snapshot ref from browser_snapshot'),
      session_id: z
        .string()
        .optional()
        .describe('CEF session id; defaults to last interacted'),
      viewId: z
        .string()
        .optional()
        .describe('Legacy alias for session_id'),
      doubleClick: z.boolean().optional().describe('If true, double-click'),
      button: z.enum(['left', 'right', 'middle']).optional().describe('Mouse button'),
      offsetX: z.number().optional().describe('X offset from element center'),
      offsetY: z.number().optional().describe('Y offset from element center'),
    }),
    execute: async (
      { ref, session_id, viewId, doubleClick, button, offsetX, offsetY },
      { toolCallId },
    ) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'browser_click',
        kind: 'browser',
        action: 'browser.interact',
        capability: 'browser.interact',
        title: `Click ${ref}`,
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

      await click(prepared.browser.client, session.sessionId, ref, {
        doubleClick,
        button,
        offsetX,
        offsetY,
      })
      return { ok: true, ref, viewId: session.viewId }
    },
  })

export default browserClick
