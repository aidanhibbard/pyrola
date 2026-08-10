import type CdpClient from '@/services/browser/cdp-client'
import { getBoxModelForObject } from '@/services/browser/cdp-geometry'
import { takeScreenshot } from '@/services/browser/cdp-screenshot'
import probeElementDom from '@/services/browser/probe-element-dom'
import saveScreenshot from '@/services/browser/screenshot-store'
import type { BrowserElementDetail } from '@/types/browser/browser-element-detail'
import type { BrowserElementSelection } from '@/types/browser/browser-element-selection'

type NodeForLocationResult = {
  backendNodeId?: number
}

type ResolveNodeResult = {
  object?: {
    objectId?: string
  }
}

type AxPropertyValue = {
  value?: unknown
}

type PartialAxNode = {
  backendDOMNodeId?: number
  role?: AxPropertyValue
  name?: AxPropertyValue
}

const axString = (value: AxPropertyValue | undefined): string | null => {
  if (!value) {
    return null
  }
  if (typeof value.value === 'string') {
    return value.value
  }
  if (typeof value.value === 'number' || typeof value.value === 'boolean') {
    return String(value.value)
  }
  return null
}

const readAxLabels = async (
  client: CdpClient,
  sessionId: string,
  backendNodeId: number,
): Promise<{ role: string | null; name: string | null }> => {
  try {
    await client.send('Accessibility.enable', {}, sessionId)
    const result = (await client.send(
      'Accessibility.getPartialAXTree',
      { backendNodeId, fetchRelatives: false },
      sessionId,
    )) as { nodes?: PartialAxNode[] }

    const nodes = Array.isArray(result.nodes) ? result.nodes : []
    const match =
      nodes.find((node) => node.backendDOMNodeId === backendNodeId) ?? nodes[0]
    if (!match) {
      return { role: null, name: null }
    }
    return {
      role: axString(match.role),
      name: axString(match.name),
    }
  } catch {
    return { role: null, name: null }
  }
}

const resolveObjectAtPoint = async (
  client: CdpClient,
  sessionId: string,
  x: number,
  y: number,
): Promise<{ backendNodeId: number; objectId: string }> => {
  await client.send('DOM.enable', {}, sessionId)
  await client.send('DOM.getDocument', { depth: 0 }, sessionId)

  const hit = (await client.send(
    'DOM.getNodeForLocation',
    {
      x: Math.round(x),
      y: Math.round(y),
      includeUserAgentShadowDOM: true,
    },
    sessionId,
  )) as NodeForLocationResult

  if (typeof hit.backendNodeId !== 'number') {
    throw new Error('No element found at the selected location')
  }

  const resolved = (await client.send(
    'DOM.resolveNode',
    { backendNodeId: hit.backendNodeId },
    sessionId,
  )) as ResolveNodeResult

  const objectId = resolved.object?.objectId
  if (typeof objectId !== 'string' || objectId.length === 0) {
    throw new Error('Failed to resolve DOM node at the selected location')
  }

  return {
    backendNodeId: hit.backendNodeId,
    objectId,
  }
}

const captureElementAtPoint = async (
  client: CdpClient,
  sessionId: string,
  x: number,
  y: number,
): Promise<BrowserElementSelection> => {
  const { backendNodeId, objectId } = await resolveObjectAtPoint(
    client,
    sessionId,
    x,
    y,
  )

  const probe = await probeElementDom(client, sessionId, objectId)
  const boundingBox = await getBoxModelForObject(client, sessionId, objectId)
  const ax = await readAxLabels(client, sessionId, backendNodeId)

  const screenshot = boundingBox
    ? await takeScreenshot(client, sessionId, { clip: boundingBox })
    : await takeScreenshot(client, sessionId, {})
  const image = await saveScreenshot(screenshot.data)

  const detail: BrowserElementDetail = {
    xpath: probe.xpath,
    cssSelector: probe.cssSelector,
    role: ax.role,
    name: ax.name,
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

export default captureElementAtPoint
