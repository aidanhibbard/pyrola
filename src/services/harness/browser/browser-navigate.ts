import { tool } from 'ai'
import { z } from 'zod'
import { navigate } from '@/services/browser/cdp-ops'
import {
  listTabs,
  setLastInteractedViewId,
  upsertTab,
} from '@/services/browser/registry'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const browserNavigate = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Navigate a CEF browser session to a URL. Auto-acquires the per-session lock when free. If another chat holds that session lock, returns browser_locked. session_id / viewId select which workbench Browser tab; omit to use last interacted.',
      [
        { url: 'https://example.com' },
        { url: 'https://example.com/docs', session_id: 'CEF_SESSION_ID' },
      ],
    ),
    inputSchema: z.object({
      url: z.string().describe('URL to open'),
      session_id: z
        .string()
        .optional()
        .describe('CEF session id; defaults to last interacted'),
      viewId: z
        .string()
        .optional()
        .describe('Legacy alias for session_id'),
    }),
    execute: async ({ url, session_id, viewId }, { toolCallId }) => {
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

      const prepared = await prepareBrowserContext(ctx, {
        sessionId: pickBrowserSessionId({ session_id, viewId }),
        autoAcquireLock: true,
        requireLock: false,
      })
      if (!prepared.ok) {
        return prepared.result
      }
      const { browser } = prepared

      const session = await resolveBrowserSession(browser)
      if (!session.ok) {
        return session.result
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
      setLastInteractedViewId(browser.workspaceId, session.viewId)

      return {
        viewId: session.viewId,
        session_id: session.viewId,
        sessionId: session.sessionId,
        url,
        navigation,
      }
    },
  })

export default browserNavigate
