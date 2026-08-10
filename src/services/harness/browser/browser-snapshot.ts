import { tool } from 'ai'
import { z } from 'zod'
import { getAccessibilitySnapshot, takeScreenshot } from '@/services/browser/cdp-ops'
import saveScreenshot from '@/services/browser/screenshot-store'
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
      'Capture an accessibility snapshot of the active browser tab. Returns YAML-like tree text and snapshotId for ref-based interactions. Optionally take a screenshot afterwards.',
      [{ take_screenshot_afterwards: false }, { viewId: 'TAB_ID' }],
    ),
    inputSchema: z.object({
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
        .describe('If true, include a screenshot imagePart after the snapshot'),
    }),
    execute: async ({ session_id, viewId, take_screenshot_afterwards }, { toolCallId }) => {
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
      )
      const yaml = formatSnapshotYaml(snapshot.nodes)

      const result: {
        snapshotId: string
        viewId: string
        yaml: string
        imageParts?: ToolImagePart[]
      } = {
        snapshotId: snapshot.snapshotId,
        viewId: session.viewId,
        yaml,
      }

      if (take_screenshot_afterwards) {
        const shot = await takeScreenshot(
          prepared.browser.client,
          session.sessionId,
        )
        const imagePart = await saveScreenshot(shot.data)
        result.imageParts = [imagePart]
      }

      return result
    },
  })

export default browserSnapshot
