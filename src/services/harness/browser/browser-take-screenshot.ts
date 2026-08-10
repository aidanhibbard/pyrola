import { tool } from 'ai'
import { z } from 'zod'
import { takeScreenshot } from '@/services/browser/cdp-ops'
import saveScreenshot from '@/services/browser/screenshot-store'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const browserTakeScreenshot = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Capture a PNG screenshot of the active browser tab (or a ref element). Returns imageParts for vision models.',
      [{ fullPage: true }, { ref: 'e12' }],
    ),
    inputSchema: z.object({
      session_id: z
        .string()
        .optional()
        .describe('CEF session id; defaults to last interacted'),
      viewId: z
        .string()
        .optional()
        .describe('Legacy alias for session_id'),
      fullPage: z.boolean().optional().describe('Capture beyond the viewport'),
      ref: z.string().optional().describe('Snapshot ref to clip to an element'),
    }),
    execute: async ({ session_id, viewId, fullPage, ref }, { toolCallId }) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'browser_take_screenshot',
        kind: 'browser',
        action: 'browser.interact',
        capability: 'browser.interact',
        title: 'Browser screenshot',
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

      const shot = await takeScreenshot(prepared.browser.client, session.sessionId, {
        fullPage,
        ref,
      })
      const imagePart = await saveScreenshot(shot.data)

      return {
        viewId: session.viewId,
        mimeType: shot.mimeType,
        imageParts: [imagePart],
      }
    },
  })

export default browserTakeScreenshot
