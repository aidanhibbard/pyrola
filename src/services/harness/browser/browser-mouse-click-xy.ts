import { tool } from 'ai'
import { z } from 'zod'
import { clickAtPoint } from '@/services/browser/cdp-ops'
import attachScreenshotAfterwards from '@/services/harness/browser/attach-screenshot-afterwards'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const browserMouseClickXy = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Click viewport coordinates (x, y). Prefer browser_click with a snapshot ref. Snapshot after the click. Do not use browser_cdp Input.* methods. take_screenshot_afterwards is an optional visual check only.',
      [{ x: 120, y: 80 }, { x: 10, y: 10, button: 'right' }],
    ),
    inputSchema: z.object({
      x: z.number().describe('Viewport X'),
      y: z.number().describe('Viewport Y'),
      button: z.enum(['left', 'right', 'middle']).optional().describe('Mouse button'),
      session_id: z
        .string()
        .optional()
        .describe('CEF session id; defaults to last interacted'),
      viewId: z.string().optional().describe('Legacy alias for session_id'),
      take_screenshot_afterwards: z
        .boolean()
        .optional()
        .describe('Optional visual check only; do not use for targeting'),
    }),
    execute: async (
      { x, y, button, session_id, viewId, take_screenshot_afterwards },
      { toolCallId },
    ) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'browser_mouse_click_xy',
        kind: 'browser',
        action: 'browser.interact',
        capability: 'browser.interact',
        title: `Click (${x}, ${y})`,
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

      await clickAtPoint(prepared.browser.client, session.sessionId, x, y, { button })
      const imageParts = await attachScreenshotAfterwards(
        prepared.browser.client,
        session.sessionId,
        take_screenshot_afterwards,
      )
      return {
        ok: true,
        x,
        y,
        viewId: session.viewId,
        ...(imageParts ? { imageParts } : {}),
      }
    },
  })

export default browserMouseClickXy
