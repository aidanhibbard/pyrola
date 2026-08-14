import type CdpClient from '@/services/browser/cdp-client'
import { applyUserAgentOverride } from '@/services/browser/cdp-user-agent'
import type { HostUserAgentData } from '@/types/browser/host-user-agent-data'
import { setLastInteractedViewId } from '@/services/browser/registry'

type BrowserSessionInput = {
  workspaceId: string
  /** CEF session id. */
  sessionId: string
  client: CdpClient
  userAgent: string
  userAgentData: HostUserAgentData | null
}

type ResolveSuccess = {
  ok: true
  /** CEF session id (tool-facing viewId). */
  viewId: string
  /**
   * Flattened CDP target session id. Empty for CEF page-target WebSockets
   * (commands go on the socket root; CdpClient omits empty sessionId).
   */
  sessionId: string
}
type ResolveFailure = { ok: false; result: { error: string } }
type ResolveResult = ResolveSuccess | ResolveFailure

/**
 * Bind agent CDP ops to the prepared CEF session's page-target client.
 * Selection of which CEF session to use happens in prepareBrowserContext
 * (session_id / viewId / last interacted). This step only applies UA and
 * returns the page-target CDP binding (empty flattened session id).
 */
const resolveBrowserSession = async (
  browser: BrowserSessionInput,
  options?: { touchLastInteracted?: boolean },
): Promise<ResolveResult> => {
  await applyUserAgentOverride(
    browser.client,
    '',
    browser.userAgent,
    browser.userAgentData,
  )
  if (options?.touchLastInteracted !== false) {
    setLastInteractedViewId(browser.workspaceId, browser.sessionId)
  }
  return { ok: true, viewId: browser.sessionId, sessionId: '' }
}

export default resolveBrowserSession
