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
}

/**
 * Selection rule: tools pass optional session_id (preferred) or viewId.
 * Both identify a CEF workbench browser session. If omitted, use the
 * workspace's last-interacted CEF session. Agents do not spawn hosts;
 * open a Browser tab in the workbench first so the session is registered.
 */
const prepareBrowserContext = async (
  ctx: HarnessToolContext,
  options: PrepareOptions = {},
): Promise<PrepareResult> => {
  const workspaceId = ctx.projectSlug
  const requireLock = options.requireLock ?? true

  const sessionId = resolveSessionIdForWorkspace(workspaceId, options.sessionId)
  if (!sessionId) {
    return {
      ok: false,
      result: {
        error:
          'No CEF browser session. Open a Browser tab in the workbench, then retry (optional session_id).',
      },
    }
  }

  if (options.autoAcquireLock) {
    try {
      const acquired = acquireLock({
        sessionId,
        workspaceId,
        chatId: ctx.chatId,
        subagentId: ctx.subagentId,
      })
      if (!acquired.ok) {
        return {
          ok: false,
          result: {
            error: 'browser_locked',
            ownerChatId: acquired.ownerChatId,
            leaseExpiresAt: acquired.leaseExpiresAt,
          },
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
