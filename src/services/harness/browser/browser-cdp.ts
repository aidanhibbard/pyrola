import { tool } from 'ai'
import { z } from 'zod'
import isCdpMethodDenied from '@/services/harness/browser/is-cdp-method-denied'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const browserCdp = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Send a raw Chrome DevTools Protocol method. Prefer higher-level browser_* tools when available. Footgun methods are denied (Input.*, Storage.*, cookie/cache writes, Page.navigate*, downloads, Target lifecycle, Emulation.*, permission grants, cert bypass).',
      [{ method: 'Runtime.evaluate', params: { expression: 'document.title', returnByValue: true } }],
    ),

    inputSchema: z.object({
      method: z.string().describe('CDP method name (e.g. Runtime.evaluate)'),
      params: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('CDP params object'),
      session_id: z
        .string()
        .optional()
        .describe('CEF session id; defaults to last interacted'),
      viewId: z
        .string()
        .optional()
        .describe('Legacy alias for session_id'),
    }),
    execute: async ({ method, params, session_id, viewId }, { toolCallId }) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'browser_cdp',
        kind: 'browser',
        action: 'browser.cdp',
        capability: 'browser.cdp',
        title: method,
      })
      if (!allowed) {
        return { rejected: true, error: 'Browser access denied' }
      }

      if (isCdpMethodDenied(method)) {
        return {
          error: 'cdp_method_denied',
          method,
          message: `CDP method "${method}" is not allowed via browser_cdp`,
        }
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

      const result = await prepared.browser.client.send(
        method,
        params ?? {},
        session.sessionId,
      )
      return { method, viewId: session.viewId, result }
    },
  })

export default browserCdp
