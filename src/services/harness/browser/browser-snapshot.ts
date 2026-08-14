import { tool } from 'ai'
import { z } from 'zod'
import { getAccessibilitySnapshot } from '@/services/browser/cdp-ops'
import attachScreenshotAfterwards from '@/services/harness/browser/attach-screenshot-afterwards'
import formatSnapshotYaml from '@/services/harness/browser/format-snapshot-yaml'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'
import type { ToolImagePart } from '@/types/harness/tool-image-part'

const browserSnapshot = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Capture an accessibility snapshot. Call after every DOM-changing action. Use snapshot refs for clicks, not screenshots. includeDiff is accepted but diffs are not supported. take_screenshot_afterwards is an optional visual check only.',
      [{ take_screenshot_afterwards: false }, { interactive: true, compact: true }],
    ),
    inputSchema: z.object({
      session_id: z
        .string()
        .optional()
        .describe('CEF session id; defaults to last interacted'),
      viewId: z.string().optional().describe('Legacy alias for session_id'),
      take_screenshot_afterwards: z
        .boolean()
        .optional()
        .describe('Optional visual check only; do not use for targeting'),
      interactive: z
        .boolean()
        .optional()
        .describe('If true, keep interactive roles and their ancestors'),
      maxDepth: z.number().optional().describe('Max tree depth (0 is the root)'),
      compact: z
        .boolean()
        .optional()
        .describe('Drop nameless generic leaf nodes'),
      selector: z
        .string()
        .optional()
        .describe('CSS selector; keep matching DOM nodes and ancestors'),
      includeDiff: z
        .boolean()
        .optional()
        .describe('Not supported; returns diffSupported: false when true'),
    }),
    execute: async (
      {
        session_id,
        viewId,
        take_screenshot_afterwards,
        interactive,
        maxDepth,
        compact,
        selector,
        includeDiff,
      },
      { toolCallId },
    ) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'browser_snapshot',
        kind: 'browser',
        action: 'browser.interact',
        capability: 'browser.interact',
        title: 'Browser snapshot',
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

      const snapshot = await getAccessibilitySnapshot(
        prepared.browser.client,
        session.sessionId,
        { interactive, maxDepth, compact, selector },
      )
      const yaml = formatSnapshotYaml(snapshot.nodes)
      const imageParts = await attachScreenshotAfterwards(
        prepared.browser.client,
        session.sessionId,
        take_screenshot_afterwards,
      )

      const result: {
        snapshotId: string
        viewId: string
        yaml: string
        imageParts?: ToolImagePart[]
        diffSupported?: false
      } = {
        snapshotId: snapshot.snapshotId,
        viewId: session.viewId,
        yaml,
      }
      if (imageParts) {
        result.imageParts = imageParts
      }
      if (includeDiff) {
        result.diffSupported = false
      }
      return result
    },
  })

export default browserSnapshot
