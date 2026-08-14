import type CdpClient from '@/services/browser/cdp-client'
import { boxCenter, getBoundingBox } from '@/services/browser/cdp-geometry'
import { resolveRef } from '@/services/browser/cdp-snapshot'

type ScrollArgs = {
  deltaX?: number
  deltaY?: number
  ref?: string
}

type DragArgs = {
  sourceRef: string
  targetRef?: string
  targetX?: number
  targetY?: number
}

export const scroll = async (
  client: CdpClient,
  sessionId: string,
  args: ScrollArgs,
): Promise<void> => {
  if (args.ref) {
    const resolved = await resolveRef(client, sessionId, args.ref)
    if (!resolved) {
      throw new Error(`Unable to resolve ref: ${args.ref}`)
    }
    await client.send(
      'DOM.scrollIntoViewIfNeeded',
      { backendNodeId: resolved.backendNodeId },
      sessionId,
    )
  }

  const deltaX = args.deltaX ?? 0
  const deltaY = args.deltaY ?? 0
  if (deltaX === 0 && deltaY === 0) {
    return
  }

  if (args.ref) {
    await client.send(
      'Input.dispatchMouseEvent',
      {
        type: 'mouseWheel',
        x: 0,
        y: 0,
        deltaX,
        deltaY,
      },
      sessionId,
    )
    return
  }

  await client.send(
    'Runtime.evaluate',
    {
      expression: `window.scrollBy(${deltaX}, ${deltaY})`,
      returnByValue: true,
    },
    sessionId,
  )
}

export const drag = async (
  client: CdpClient,
  sessionId: string,
  args: DragArgs,
): Promise<void> => {
  const sourceBox = await getBoundingBox(client, sessionId, args.sourceRef)
  if (!sourceBox) {
    throw new Error(`Unable to get source bounding box for ref: ${args.sourceRef}`)
  }
  const source = boxCenter(sourceBox)

  let target = { x: args.targetX ?? source.x, y: args.targetY ?? source.y }
  if (args.targetRef) {
    const targetBox = await getBoundingBox(client, sessionId, args.targetRef)
    if (!targetBox) {
      throw new Error(`Unable to get target bounding box for ref: ${args.targetRef}`)
    }
    target = boxCenter(targetBox)
  }

  await client.send(
    'Input.dispatchMouseEvent',
    {
      type: 'mousePressed',
      x: source.x,
      y: source.y,
      button: 'left',
      buttons: 1,
      clickCount: 1,
    },
    sessionId,
  )

  const steps = 10
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    const x = source.x + (target.x - source.x) * t
    const y = source.y + (target.y - source.y) * t
    await client.send(
      'Input.dispatchMouseEvent',
      {
        type: 'mouseMoved',
        x,
        y,
        button: 'left',
        buttons: 1,
      },
      sessionId,
    )
  }

  await client.send(
    'Input.dispatchMouseEvent',
    {
      type: 'mouseReleased',
      x: target.x,
      y: target.y,
      button: 'left',
      buttons: 0,
      clickCount: 1,
    },
    sessionId,
  )
}
