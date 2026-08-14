import type CdpClient from '@/services/browser/cdp-client'
import {
  DESKTOP_CHROME_USER_AGENT,
  DESKTOP_CHROME_USER_AGENT_DATA,
} from '@/services/browser/desktop-chrome-user-agent'
import type { HostUserAgentData } from '@/types/browser/host-user-agent-data'
import {
  acquireLock,
  assertLockedBy,
  getSessionCdpClient,
  resolveSessionIdForWorkspace,
} from '@/services/browser/registry'
import ensureWorkspaceCefSession from '@/services/browser/ensure-workspace-cef-session'
import lockErrorResult from '@/services/harness/browser/lock-error-result'
import ensureWorkbenchBrowser from '@/services/harness/browser/ensure-workbench-browser'
import type { HarnessToolContext } from '@/types/harness/tool-context'

type PrepareSuccess = {
  ok: true
  browser: {
    workspaceId: string
    /** CEF session id (also used as tool viewId). */
    sessionId: string
    client: CdpClient
    userAgent: string
    userAgentData: HostUserAgentData | null
  }
}
type PrepareFailure = { ok: false; result: Record<string, unknown> }
type PrepareResult = PrepareSuccess | PrepareFailure

type PrepareOptions = {
  /** CEF session id (or legacy viewId). Defaults to last interacted for the workspace. */
  sessionId?: string
  /** When true, acquire the lock if free or held by this chat. */
  autoAcquireLock?: boolean
  /** When true (default), require an active lock owned by this chat. */
  requireLock?: boolean
  /** When creating a missing workbench tab, focus it (active/side). */
  revealPosition?: 'active' | 'side'
}

/**
 * Selection rule: tools pass optional session_id (preferred) or viewId.
 * Both identify a CEF workbench browser session. If omitted, use this
 * chat's preferred CEF session, then the workspace last-interacted
 * session. If none exists, open the workbench Browser tab and create
 * a CEF session.
 */
const prepareBrowserContext = async (
  ctx: HarnessToolContext,
  options: PrepareOptions = {},
): Promise<PrepareResult> => {
  const workspaceId = ctx.projectSlug
  const requireLock = options.requireLock ?? true

  let sessionId: string | null
  const requestedId = options.sessionId?.trim()
  if (requestedId) {
    const resolved = resolveSessionIdForWorkspace(
      workspaceId,
      requestedId,
      ctx.chatId,
    )
    if (!resolved) {
      return {
        ok: false,
        result: { error: `Unknown CEF session: ${requestedId}` },
      }
    }
    sessionId = resolved
  } else {
    sessionId = resolveSessionIdForWorkspace(workspaceId, undefined, ctx.chatId)
  }

  if (!sessionId) {
    const opened = await ensureWorkbenchBrowser({
      projectSlug: workspaceId,
      position: options.revealPosition,
    })
    if (!opened.ok) {
      return { ok: false, result: { error: opened.error } }
    }
    try {
      sessionId = await ensureWorkspaceCefSession(workspaceId)
    } catch (error) {
      return {
        ok: false,
        result: {
          error:
            error instanceof Error
              ? error.message
              : 'Failed to create a CEF browser session',
        },
      }
    }
  }

  if (options.autoAcquireLock) {
    try {
      const acquired = await acquireLock({
        sessionId,
        workspaceId,
        chatId: ctx.chatId,
        subagentId: ctx.subagentId,
        wait: false,
      })
      if (!acquired.ok) {
        return {
          ok: false,
          result: lockErrorResult(acquired),
        }
      }
    } catch (error) {
      return {
        ok: false,
        result: {
          error: error instanceof Error ? error.message : 'Failed to acquire browser lock',
        },
      }
    }
  } else if (requireLock) {
    const locked = assertLockedBy({
      sessionId,
      chatId: ctx.chatId,
    })
    if (!locked.ok) {
      return {
        ok: false,
        result: {
          error: 'browser_locked',
          ownerChatId: locked.ownerChatId,
        },
      }
    }
  }

  const userAgent = DESKTOP_CHROME_USER_AGENT
  const userAgentData = DESKTOP_CHROME_USER_AGENT_DATA

  try {
    const client = await getSessionCdpClient(sessionId)
    return {
      ok: true,
      browser: {
        workspaceId,
        sessionId,
        client,
        userAgent,
        userAgentData,
      },
    }
  } catch (error) {
    return {
      ok: false,
      result: {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to connect CDP for CEF session',
      },
    }
  }
}

export default prepareBrowserContext
