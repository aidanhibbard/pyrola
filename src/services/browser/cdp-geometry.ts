import type CdpClient from '@/services/browser/cdp-client'
import { resolveRef } from '@/services/browser/cdp-snapshot'

type BoxModelResult = {
  model?: {
    content?: number[]
    border?: number[]
    width?: number
    height?: number
  }
}

type BoundingBox = {
  x: number
  y: number
  width: number
  height: number
}

const quadToBox = (quad: number[]): BoundingBox | null => {
  if (quad.length < 8) {
    return null
  }
  const xs = [quad[0]!, quad[2]!, quad[4]!, quad[6]!]
  const ys = [quad[1]!, quad[3]!, quad[5]!, quad[7]!]
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export const boxCenter = (
  box: BoundingBox,
  offsetX = 0,
  offsetY = 0,
): { x: number; y: number } => ({
  x: box.x + box.width / 2 + offsetX,
  y: box.y + box.height / 2 + offsetY,
})

export const getBoxModelForObject = async (
  client: CdpClient,
  sessionId: string,
  objectId: string,
): Promise<BoundingBox | null> => {
  const result = (await client.send(
    'DOM.getBoxModel',
    { objectId },
    sessionId,
  )) as BoxModelResult
  const border = result.model?.border
  if (Array.isArray(border)) {
    return quadToBox(border)
  }
  const content = result.model?.content
  if (Array.isArray(content)) {
    return quadToBox(content)
  }
  return null
}

export const getBoundingBox = async (
  client: CdpClient,
  sessionId: string,
  ref: string,
): Promise<BoundingBox | null> => {
  const resolved = await resolveRef(client, sessionId, ref)
  if (!resolved) {
    return null
  }
  return getBoxModelForObject(client, sessionId, resolved.objectId)
}

export const highlight = async (
  client: CdpClient,
  sessionId: string,
  ref: string,
): Promise<void> => {
  const resolved = await resolveRef(client, sessionId, ref)
  if (!resolved) {
    throw new Error(`Unable to resolve ref: ${ref}`)
  }

  await client.send('Overlay.enable', {}, sessionId)
  await client.send(
    'Overlay.highlightNode',
    {
      highlightConfig: {
        borderColor: { r: 255, g: 0, b: 0, a: 0.9 },
        contentColor: { r: 255, g: 0, b: 0, a: 0.15 },
        showInfo: true,
      },
      backendNodeId: resolved.backendNodeId,
    },
    sessionId,
  )
  await client.send('Overlay.hideHighlight', {}, sessionId)
}
