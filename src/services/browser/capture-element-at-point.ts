import type CdpClient from '@/services/browser/cdp-client'
import captureElementByBackendNodeId from '@/services/browser/capture-element-by-node'
import type { BrowserElementSelection } from '@/types/browser/browser-element-selection'

type NodeForLocationResult = {
  backendNodeId?: number
}

const resolveBackendNodeAtPoint = async (
  client: CdpClient,
  sessionId: string,
  x: number,
  y: number,
): Promise<number> => {
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

  return hit.backendNodeId
}

const captureElementAtPoint = async (
  client: CdpClient,
  sessionId: string,
  x: number,
  y: number,
): Promise<BrowserElementSelection> => {
  const backendNodeId = await resolveBackendNodeAtPoint(client, sessionId, x, y)
  return captureElementByBackendNodeId(client, sessionId, backendNodeId)
}

export default captureElementAtPoint
