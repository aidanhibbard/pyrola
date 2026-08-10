import { tool } from 'ai'
import { z } from 'zod'
import { drag } from '@/services/browser/cdp-ops'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const browserDrag = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Drag from a source snapshot ref to a target ref or coordinates.',
      [{ sourceRef: 'e1', targetRef: 'e2' }, { sourceRef: 'e1', targetX: 100, targetY: 200 }],
    ),
    inputSchema: z.object({
      sourceRef: z.string().describe('Source snapshot ref'),
      targetRef: z.string().optional().describe('Target snapshot ref'),
      targetX: z.number().optional().describe('Target X when targetRef is omitted'),
      targetY: z.number().optional().describe('Target Y when targetRef is omitted'),
      session_id: z
        .string()
        .optional()
        .describe('CEF session id; defaults to last interacted'),
      viewId: z
        .string()
        .optional()
        .describe('Legacy alias for session_id'),
    }),
    execute: async (
      { sourceRef, targetRef, targetX, targetY, session_id, viewId },
      { toolCallId },
    ) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'browser_drag',
        kind: 'browser',
        action: 'browser.interact',
        capability: 'browser.interact',
        title: `Drag ${sourceRef}`,
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

      await drag(prepared.browser.client, session.sessionId, {
        sourceRef,
        targetRef,
        targetX,
        targetY,
      })
      return { ok: true, sourceRef, viewId: session.viewId }
    },
  })

export default browserDrag
