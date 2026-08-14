import { tool } from 'ai'
import { z } from 'zod'
import isCdpMethodDenied from '@/services/harness/browser/is-cdp-method-denied'
import attachScreenshotAfterwards from '@/services/harness/browser/attach-screenshot-afterwards'
import formatCdpSendFailure from '@/services/harness/browser/format-cdp-send-failure'
import invalidCdpParams from '@/services/harness/browser/invalid-cdp-params'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const EVALUATE_EXAMPLE = {
  method: 'Runtime.evaluate',
  params: { expression: 'document.title', returnByValue: true },
}

const CALL_FUNCTION_ON_EXAMPLE = {
  method: 'Runtime.callFunctionOn',
  params: {
    functionDeclaration: 'function() { return this.title }',
    returnByValue: true,
  },
}

const browserCdp = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Send a raw Chrome DevTools Protocol method. Prefer higher-level browser_* tools. Input.* is denied; use browser_click and related tools. Snapshot after calls that change the DOM. take_screenshot_afterwards is an optional visual check only. Footgun methods are denied (Storage.*, cookie/cache writes, Page.navigate*, downloads, Target lifecycle, Emulation.*, permission grants, cert bypass). For Runtime.evaluate, params.expression must be a JavaScript string, not an object. Wrong: { "method": "Runtime.evaluate", "params": { "expression": { "expression": "document.title" } } }. Right: { "method": "Runtime.evaluate", "params": { "expression": "document.title", "returnByValue": true } }. Nested { expression: "..." } is invalid.',
      [EVALUATE_EXAMPLE],
    ),

    inputSchema: z.object({
      method: z.string().describe('CDP method name (e.g. Runtime.evaluate)'),
      params: z
        .object({
          expression: z
            .string()
            .optional()
            .describe(
              'JS source as a string, never { expression: "..." }.',
            ),
          functionDeclaration: z
            .string()
            .optional()
            .describe(
              'JS function source as a string, never a nested object.',
            ),
          returnByValue: z.boolean().optional(),
        })
        .passthrough()
        .optional()
        .describe(
          'CDP params object. For Runtime.evaluate, expression must be a JS source string (e.g. "document.title"), not an object.',
        ),
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
    execute: async ({ method, params, session_id, viewId, take_screenshot_afterwards }, { toolCallId }) => {
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

      const rawParams = (params ?? {}) as Record<string, unknown>
      if (
        method === 'Runtime.evaluate' &&
        rawParams.expression !== undefined &&
        typeof rawParams.expression !== 'string'
      ) {
        return invalidCdpParams(
          'params.expression',
          rawParams.expression,
          EVALUATE_EXAMPLE,
        )
      }
      if (
        method === 'Runtime.callFunctionOn' &&
        rawParams.functionDeclaration !== undefined &&
        typeof rawParams.functionDeclaration !== 'string'
      ) {
        return invalidCdpParams(
          'params.functionDeclaration',
          rawParams.functionDeclaration,
          CALL_FUNCTION_ON_EXAMPLE,
        )
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

      try {
        const result = await prepared.browser.client.send(
          method,
          rawParams,
          session.sessionId,
        )
        const imageParts = await attachScreenshotAfterwards(
          prepared.browser.client,
          session.sessionId,
          take_screenshot_afterwards,
        )
        return { method, viewId: session.viewId, result, ...(imageParts ? { imageParts } : {}) }
      } catch (error) {
        return formatCdpSendFailure(method, error)
      }
    },
  })

export default browserCdp
