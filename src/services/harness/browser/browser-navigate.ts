import { tool } from 'ai'
import { z } from 'zod'
import { navigate } from '@/services/browser/cdp-ops'
import createCefSession from '@/services/browser/create-cef-session'
import {
  listTabs,
  setLastInteractedViewId,
  upsertTab,
} from '@/services/browser/registry'
import attachScreenshotAfterwards from '@/services/harness/browser/attach-screenshot-afterwards'
import ensureWorkbenchBrowser from '@/services/harness/browser/ensure-workbench-browser'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import revealBrowserSession from '@/services/harness/browser/reveal-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const browserNavigate = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Navigate a CEF session to a URL. Auto-acquires the per-session lock when free (wait:false). If no session exists, this may open the workbench browser. Omit position unless the user asked to reveal or focus the browser. Snapshot after navigation. take_screenshot_afterwards is an optional visual check only.',
      [
        { url: 'https://example.com' },
        { url: 'https://example.com/docs', session_id: 'CEF_SESSION_ID' },
        { url: 'https://example.com', newTab: true },
      ],
    ),
    inputSchema: z.object({
      url: z.string().describe('URL to open'),
      session_id: z
        .string()
        .optional()
        .describe('CEF session id; defaults to last interacted'),
      viewId: z.string().optional().describe('Legacy alias for session_id'),
      newTab: z.boolean().optional().describe('Create a new CEF session, then navigate'),
      position: z
        .enum(['active', 'side'])
        .optional()
        .describe('Focus the workbench Browser (active or side). Omit unless the user asked to reveal or focus.'),
      take_screenshot_afterwards: z
        .boolean()
        .optional()
        .describe('Optional visual check only; do not use for targeting'),
    }),
    execute: async (
      { url, session_id, viewId, newTab, position, take_screenshot_afterwards },
      { toolCallId },
    ) => {
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'browser_navigate',
        kind: 'browser',
        action: 'browser.navigate',
        capability: 'browser.navigate',
        title: url,
      })
      if (!allowed) {
        return { rejected: true, error: 'Browser access denied' }
      }

      let targetId = pickBrowserSessionId({ session_id, viewId })
      if (newTab) {
        const opened = await ensureWorkbenchBrowser({
          projectSlug: ctx.projectSlug,
          position,
        })
        if (!opened.ok) {
          return { error: opened.error }
        }
        targetId = await createCefSession(ctx.projectSlug)
      }

      const prepared = await prepareBrowserContext(ctx, {
        sessionId: targetId,
        autoAcquireLock: true,
        requireLock: false,
        revealPosition: position,
      })
      if (!prepared.ok) {
        return prepared.result
      }
      const { browser } = prepared

      const session = await resolveBrowserSession(browser, {
        touchLastInteracted: Boolean(position) || !newTab,
      })
      if (!session.ok) {
        return session.result
      }

      if (position) {
        const revealed = await revealBrowserSession({
          projectSlug: ctx.projectSlug,
          sessionId: session.viewId,
          position,
        })
        if (revealed.error) {
          return { error: revealed.error }
        }
      }

      const navigation = await navigate(browser.client, session.sessionId, url)
      const prior = listTabs(browser.workspaceId).find(
        (tab) => tab.viewId === session.viewId,
      )
      upsertTab(browser.workspaceId, {
        viewId: session.viewId,
        workspaceId: browser.workspaceId,
        url,
        title: prior?.title ?? null,
        createdAt: prior?.createdAt ?? new Date().toISOString(),
      })
      if (position || !newTab) {
        setLastInteractedViewId(browser.workspaceId, session.viewId)
      }

      const imageParts = await attachScreenshotAfterwards(
        browser.client,
        session.sessionId,
        take_screenshot_afterwards,
      )

      return {
        viewId: session.viewId,
        session_id: session.viewId,
        sessionId: session.sessionId,
        url,
        navigation,
        ...(imageParts ? { imageParts } : {}),
      }
    },
  })

export default browserNavigate
