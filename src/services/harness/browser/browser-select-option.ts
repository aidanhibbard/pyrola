import { tool } from 'ai'
import { z } from 'zod'
import { selectOption } from '@/services/browser/cdp-ops'
import attachScreenshotAfterwards from '@/services/harness/browser/attach-screenshot-afterwards'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const browserSelectOption = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Select an option on a select element by snapshot ref. Snapshot afterwards. take_screenshot_afterwards is an optional visual check only.',
      [{ ref: 'e8', value: 'us' }],
    ),
    inputSchema: z.object({
      ref: z.string().describe('Snapshot ref from browser_snapshot'),
      value: z.string().describe('Option value to select'),
      session_id: z
        .string()
        .optional()
        .describe('CEF session id; defaults to last interacted'),
      viewId: z
        .string()
        .optional()
        .describe('Legacy alias for session_id'),
      take_screenshot_afterwards: z
        .boolean()
        .optional()
        .describe('Optional visual check only; do not use for targeting'),
    }),
    execute: async ({ ref, value, session_id, viewId, take_screenshot_afterwards }, { toolCallId }) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'browser_select_option',
        kind: 'browser',
        action: 'browser.interact',
        capability: 'browser.interact',
        title: `Select ${value} on ${ref}`,
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

      await selectOption(prepared.browser.client, session.sessionId, ref, value)
      const imageParts = await attachScreenshotAfterwards(
        prepared.browser.client,
        session.sessionId,
        take_screenshot_afterwards,
      )
      return { ok: true, ref, value, viewId: session.viewId, ...(imageParts ? { imageParts } : {}) }
    },
  })

export default browserSelectOption
