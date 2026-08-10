import { tool } from 'ai'
import { z } from 'zod'
import { pressKey } from '@/services/browser/cdp-ops'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const browserPressKey = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Press a key in the shared browser (optionally with modifiers).',
      [{ key: 'Enter' }, { key: 'a', modifiers: 4 }],
    ),
    inputSchema: z.object({
      key: z.string().describe('Key to press (e.g. Enter, Tab, a)'),
      modifiers: z
        .number()
        .optional()
        .describe('CDP modifier bitmask (Alt=1, Ctrl=2, Meta=4, Shift=8)'),
      session_id: z
        .string()
        .optional()
        .describe('CEF session id; defaults to last interacted'),
      viewId: z
        .string()
        .optional()
        .describe('Legacy alias for session_id'),
    }),
    execute: async ({ key, modifiers, session_id, viewId }, { toolCallId }) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'browser_press_key',
        kind: 'browser',
        action: 'browser.interact',
        capability: 'browser.interact',
        title: `Press ${key}`,
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

      await pressKey(prepared.browser.client, session.sessionId, key, modifiers ?? 0)
      return { ok: true, key, viewId: session.viewId }
    },
  })

export default browserPressKey
