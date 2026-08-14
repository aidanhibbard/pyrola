import { tool } from 'ai'
import { z } from 'zod'
import createCefSession from '@/services/browser/create-cef-session'
import destroyCefSession from '@/services/browser/destroy-cef-session'
import {
  listTabs,
  setLastInteractedViewId,
} from '@/services/browser/registry'
import ensureWorkbenchBrowser from '@/services/harness/browser/ensure-workbench-browser'
import pickBrowserSessionId from '@/services/harness/browser/pick-browser-session-id'
import prepareBrowserContext from '@/services/harness/browser/prepare-browser-context'
import resolveBrowserSession from '@/services/harness/browser/resolve-browser-session'
import revealBrowserSession from '@/services/harness/browser/reveal-browser-session'
import { gateToolPermission } from '@/services/harness/permission/gate'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const pickTargetId = (
  workspaceId: string,
  args: { session_id?: string; viewId?: string; index?: number },
): string | undefined => {
  const picked = pickBrowserSessionId(args)
  if (picked) {
    return picked
  }
  if (typeof args.index === 'number') {
    return listTabs(workspaceId)[args.index]?.viewId
  }
  return undefined
}

const browserTabs = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'List CEF pages, then lock a specific session_id. If none exist, action new (or browser_navigate) may open the workbench browser. list needs no lock. select/close require an active lock. Omit position on new unless the user asked to reveal or focus the browser. position active or side focuses the workbench Browser.',
      [
        { action: 'list' },
        { action: 'select', session_id: 'CEF_SESSION_ID' },
        { action: 'new' },
        { action: 'close', index: 0 },
      ],
    ),
    inputSchema: z.object({
      action: z.enum(['list', 'select', 'new', 'close']).describe('Tab action'),
      session_id: z.string().optional().describe('CEF session id for select/close'),
      viewId: z.string().optional().describe('Legacy alias for session_id'),
      index: z.number().optional().describe('0-based page index for select/close'),
      position: z
        .enum(['active', 'side'])
        .optional()
        .describe('On new: focus the workbench Browser. Omit unless the user asked to reveal or focus.'),
      url: z.string().optional().describe('Ignored (legacy)'),
    }),
    execute: async (
      { action, session_id, viewId, index, position },
      { toolCallId },
    ) => {
      if (action !== 'list') {
        const allowed = await gateToolPermission({
          ctx: toPermCtx(ctx),
          toolCallId,
          name: 'browser_tabs',
          kind: 'browser',
          action: 'browser.interact',
          capability: 'browser.interact',
          title: `Browser tabs: ${action}`,
        })
        if (!allowed) {
          return { rejected: true, error: 'Browser access denied' }
        }
      }

      if (action === 'list') {
        return { tabs: listTabs(ctx.projectSlug) }
      }

      if (action === 'new') {
        const opened = await ensureWorkbenchBrowser({
          projectSlug: ctx.projectSlug,
          position,
        })
        if (!opened.ok) {
          return { error: opened.error }
        }
        const createdId = await createCefSession(ctx.projectSlug)
        const prepared = await prepareBrowserContext(ctx, {
          sessionId: createdId,
          autoAcquireLock: true,
          requireLock: false,
          revealPosition: position,
        })
        if (!prepared.ok) {
          return prepared.result
        }
        const revealed = await revealBrowserSession({
          projectSlug: ctx.projectSlug,
          sessionId: createdId,
          position,
        })
        if (revealed.error) {
          return { error: revealed.error, session_id: createdId, viewId: createdId }
        }
        return {
          viewId: createdId,
          session_id: createdId,
          sessionId: createdId,
          tab: listTabs(ctx.projectSlug).find((tab) => tab.viewId === createdId) ?? null,
        }
      }

      const targetId = pickTargetId(ctx.projectSlug, { session_id, viewId, index })
      if (!targetId) {
        return { error: 'session_id or index is required for this action' }
      }

      const prepared = await prepareBrowserContext(ctx, {
        sessionId: targetId,
        requireLock: true,
      })
      if (!prepared.ok) {
        return prepared.result
      }
      const { browser } = prepared

      if (action === 'close') {
        await destroyCefSession(targetId)
        const remaining = listTabs(browser.workspaceId)
        return {
          closed: true,
          viewId: targetId,
          session_id: targetId,
          remaining,
        }
      }

      const session = await resolveBrowserSession(browser)
      if (!session.ok) {
        return session.result
      }

      setLastInteractedViewId(browser.workspaceId, session.viewId)
      const existing = listTabs(browser.workspaceId).find(
        (tab) => tab.viewId === session.viewId,
      )
      return {
        viewId: session.viewId,
        session_id: session.viewId,
        sessionId: session.sessionId,
        tab: existing ?? null,
      }
    },
  })

export default browserTabs
