import { tool } from 'ai'
import { z } from 'zod'
import { type as typeInto } from '@/services/browser/cdp-ops'
import attachScreenshotAfterwards from '@/services/harness/browser/attach-screenshot-afterwards'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const browserType = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Type text into an element by snapshot ref. Prefer browser_fill to replace existing values. Snapshot afterwards. take_screenshot_afterwards is an optional visual check only. element is a description only.',
      [{ ref: 'e5', text: 'hello' }, { ref: 'e5', text: 'hello', clear: true, submit: true }],
    ),
    inputSchema: z.object({
      ref: z.string().describe('Snapshot ref from browser_snapshot'),
      text: z.string().describe('Text to type'),
      session_id: z
        .string()
        .optional()
        .describe('CEF session id; defaults to last interacted'),
      viewId: z.string().optional().describe('Legacy alias for session_id'),
      clear: z.boolean().optional().describe('Select all and delete before typing'),
      submit: z.boolean().optional().describe('Press Enter after typing'),
      slowly: z.boolean().optional().describe('Type character by character'),
      element: z
        .string()
        .optional()
        .describe('Human description of the target; not used for targeting'),
      take_screenshot_afterwards: z
        .boolean()
        .optional()
        .describe('Optional visual check only; do not use for targeting'),
    }),
    execute: async (
      {
        ref,
        text,
        session_id,
        viewId,
        clear,
        submit,
        slowly,
        element,
        take_screenshot_afterwards,
      },
      { toolCallId },
    ) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'browser_type',
        kind: 'browser',
        action: 'browser.interact',
        capability: 'browser.interact',
        title: `Type into ${ref}`,
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

      await typeInto(prepared.browser.client, session.sessionId, ref, text, {
        clear,
        submit,
        slowly,
      })
      const imageParts = await attachScreenshotAfterwards(
        prepared.browser.client,
        session.sessionId,
        take_screenshot_afterwards,
      )
      return {
        ok: true,
        ref,
        viewId: session.viewId,
        ...(element ? { element } : {}),
        ...(imageParts ? { imageParts } : {}),
      }
    },
  })

export default browserType
