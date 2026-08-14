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
      'Optional visual check of the tab or a ref element (PNG default). Screenshots are for vision, not targeting; use refs for clicks. Returns imageParts for vision models.',
      [{ fullPage: true }, { ref: 'e12' }, { type: 'jpeg' }],
    ),
    inputSchema: z.object({
      session_id: z
        .string()
        .optional()
        .describe('CEF session id; defaults to last interacted'),
      viewId: z.string().optional().describe('Legacy alias for session_id'),
      fullPage: z.boolean().optional().describe('Capture beyond the viewport'),
      ref: z.string().optional().describe('Snapshot ref to clip to an element'),
      element: z
        .string()
        .optional()
        .describe('Human description of the target; not used for clipping'),
      type: z.enum(['png', 'jpeg']).optional().describe('Image format (png default)'),
    }),
    execute: async (
      { session_id, viewId, fullPage, ref, element, type },
      { toolCallId },
    ) => {
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
        type,
      })
      const imagePart = await saveScreenshot(shot.data, shot.mimeType)

      return {
        viewId: session.viewId,
        mimeType: shot.mimeType,
        imageParts: [imagePart],
        ...(element ? { element } : {}),
      }
    },
  })

export default browserTakeScreenshot
