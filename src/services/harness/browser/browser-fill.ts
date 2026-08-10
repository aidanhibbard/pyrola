import { tool } from 'ai'
import { z } from 'zod'
import { fill } from '@/services/browser/cdp-ops'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const browserFill = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Clear and fill an input by snapshot ref.',
      [{ ref: 'e5', value: 'user@example.com' }],
    ),
    inputSchema: z.object({
      ref: z.string().describe('Snapshot ref from browser_snapshot'),
      value: z.string().describe('Value to fill'),
      session_id: z
        .string()
        .optional()
        .describe('CEF session id; defaults to last interacted'),
      viewId: z
        .string()
        .optional()
        .describe('Legacy alias for session_id'),
    }),
    execute: async ({ ref, value, session_id, viewId }, { toolCallId }) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'browser_fill',
        kind: 'browser',
        action: 'browser.interact',
        capability: 'browser.interact',
        title: `Fill ${ref}`,
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

      await fill(prepared.browser.client, session.sessionId, ref, value)
      return { ok: true, ref, viewId: session.viewId }
    },
  })

export default browserFill
