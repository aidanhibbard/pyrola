import { tool } from 'ai'
import { z } from 'zod'
import { getBoundingBox } from '@/services/browser/cdp-ops'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const browserGetBoundingBox = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Get the bounding box for a snapshot ref in the shared browser.',
      [{ ref: 'e12' }],
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
    }),
    execute: async ({ ref, session_id, viewId }, { toolCallId }) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'browser_get_bounding_box',
        kind: 'browser',
        action: 'browser.interact',
        capability: 'browser.interact',
        title: `Bounding box ${ref}`,
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

      const box = await getBoundingBox(
        prepared.browser.client,
        session.sessionId,
        ref,
      )
      if (!box) {
        return { error: `Unable to resolve bounding box for ref: ${ref}`, ref }
      }
      return { ref, viewId: session.viewId, box }
    },
  })

export default browserGetBoundingBox
