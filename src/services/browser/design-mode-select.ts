import {
  getBoundingBox,
  getSnapshotNode,
  resolveRef,
  takeScreenshot,
} from '@/services/browser/cdp-ops'
import {
  DESKTOP_CHROME_USER_AGENT,
  DESKTOP_CHROME_USER_AGENT_DATA,
} from '@/services/browser/desktop-chrome-user-agent'
import {
  getLastInteractedViewId,
  getSessionCdpClient,
  listTabs,
  resolveSessionIdForWorkspace,
} from '@/services/browser/registry'
import { applyUserAgentOverride } from '@/services/browser/cdp-user-agent'
import probeElementDom from '@/services/browser/probe-element-dom'
import saveScreenshot from '@/services/browser/screenshot-store'
import type { BrowserElementDetail } from '@/types/browser/browser-element-detail'
import type { BrowserElementSelection } from '@/types/browser/browser-element-selection'

const resolveActiveSessionId = (workspaceId: string, sessionId?: string): string => {
  const resolved = resolveSessionIdForWorkspace(workspaceId, sessionId)
  if (resolved) {
    return resolved
  }
  const lastId = getLastInteractedViewId(workspaceId)
  if (lastId) {
    return lastId
  }
  const tabs = listTabs(workspaceId)
  const first = tabs[0]
  if (!first) {
    throw new Error('No browser tab open. Open a Browser tab in the workbench first.')
  }
  return first.viewId
}

const captureElementSelection = async (
  workspaceId: string,
  ref: string,
  sessionId?: string,
): Promise<BrowserElementSelection> => {
  const trimmedRef = ref.trim()
  if (!trimmedRef) {
    throw new Error('Element ref is required')
  }

  const cefSessionId = resolveActiveSessionId(workspaceId, sessionId)
  const client = await getSessionCdpClient(cefSessionId)
  // Page-target CDP: empty flattened session id.
  const cdpSessionId = ''
  await applyUserAgentOverride(
    client,
    cdpSessionId,
    DESKTOP_CHROME_USER_AGENT,
    DESKTOP_CHROME_USER_AGENT_DATA,
  )

  const resolved = await resolveRef(client, cdpSessionId, trimmedRef)
  if (!resolved) {
    throw new Error(
      `Unknown ref "${trimmedRef}". Take a browser snapshot first, then use a ref from that snapshot.`,
    )
  }

  const axNode = getSnapshotNode(cdpSessionId, trimmedRef)
  const boundingBox = await getBoundingBox(client, cdpSessionId, trimmedRef)
  const screenshot = await takeScreenshot(client, cdpSessionId, { ref: trimmedRef })
  const image = await saveScreenshot(screenshot.data)
  const probe = await probeElementDom(client, cdpSessionId, resolved.objectId)

  const detail: BrowserElementDetail = {
    xpath: probe.xpath,
    cssSelector: probe.cssSelector,
    role: axNode?.role ?? null,
    name: axNode?.name ?? null,
    attributes: probe.attributes,
    boundingBox,
    computedStyles: probe.computedStyles,
    componentHint: null,
    screenshotPath: image.path,
  }

  return {
    detail,
    screenshotPath: image.path,
  }
}

export default captureElementSelection
