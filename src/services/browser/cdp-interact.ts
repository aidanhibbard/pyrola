import type CdpClient from '@/services/browser/cdp-client'
import {
  boxCenter,
  getBoxModelForObject,
  getBoundingBox,
} from '@/services/browser/cdp-geometry'
import {
  dispatchClickAt,
  evaluateBoolean,
  keyDefinition,
  type ClickOptions,
} from '@/services/browser/cdp-input-helpers'
import { resolveRef } from '@/services/browser/cdp-snapshot'

export { getBoundingBox, highlight } from '@/services/browser/cdp-geometry'

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

export const click = async (
  client: CdpClient,
  sessionId: string,
  ref: string,
  options: ClickOptions = {},
): Promise<void> => {
  const resolved = await resolveRef(client, sessionId, ref)
  if (!resolved) {
    throw new Error(`Unable to resolve ref: ${ref}`)
  }
  const box = await getBoxModelForObject(client, sessionId, resolved.objectId)
  if (!box) {
    throw new Error(`Unable to get bounding box for ref: ${ref}`)
  }
  const point = boxCenter(box, options.offsetX ?? 0, options.offsetY ?? 0)
  await dispatchClickAt(client, sessionId, point, options)
}

export const pressKey = async (
  client: CdpClient,
  sessionId: string,
  key: string,
  modifiers = 0,
): Promise<void> => {
  const def = keyDefinition(key)
  await client.send(
    'Input.dispatchKeyEvent',
    {
      type: 'keyDown',
      key: def.key,
      code: def.code,
      text: def.text,
      windowsVirtualKeyCode: def.windowsVirtualKeyCode,
      nativeVirtualKeyCode: def.windowsVirtualKeyCode,
      modifiers,
    },
    sessionId,
  )
  await client.send(
    'Input.dispatchKeyEvent',
    {
      type: 'keyUp',
      key: def.key,
      code: def.code,
      windowsVirtualKeyCode: def.windowsVirtualKeyCode,
      nativeVirtualKeyCode: def.windowsVirtualKeyCode,
      modifiers,
    },
    sessionId,
  )
}

export const type = async (
  client: CdpClient,
  sessionId: string,
  ref: string,
  text: string,
): Promise<void> => {
  const resolved = await resolveRef(client, sessionId, ref)
  if (!resolved) {
    throw new Error(`Unable to resolve ref: ${ref}`)
  }

  await click(client, sessionId, ref)

  const isRichText = await evaluateBoolean(
    client,
    sessionId,
    resolved.objectId,
    `function() {
      const tag = (this.tagName || '').toLowerCase();
      if (tag === 'textarea') return true;
      return !!this.isContentEditable;
    }`,
  )

  if (!isRichText) {
    await client.send('Input.insertText', { text }, sessionId)
    return
  }

  for (const char of text) {
    const def = keyDefinition(char)
    await client.send(
      'Input.dispatchKeyEvent',
      {
        type: 'keyDown',
        key: def.key,
        code: def.code,
        text: def.text ?? char,
        windowsVirtualKeyCode: def.windowsVirtualKeyCode,
        nativeVirtualKeyCode: def.windowsVirtualKeyCode,
      },
      sessionId,
    )
    await client.send(
      'Input.dispatchKeyEvent',
      {
        type: 'keyUp',
        key: def.key,
        code: def.code,
        windowsVirtualKeyCode: def.windowsVirtualKeyCode,
        nativeVirtualKeyCode: def.windowsVirtualKeyCode,
      },
      sessionId,
    )
  }
}

export const fill = async (
  client: CdpClient,
  sessionId: string,
  ref: string,
  value: string,
): Promise<void> => {
  await click(client, sessionId, ref)

  const selectModifier =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? 4 : 2

  await pressKey(client, sessionId, 'a', selectModifier)
  await pressKey(client, sessionId, 'Backspace')
  await client.send('Input.insertText', { text: value }, sessionId)
}

export const selectOption = async (
  client: CdpClient,
  sessionId: string,
  ref: string,
  value: string,
): Promise<void> => {
  const resolved = await resolveRef(client, sessionId, ref)
  if (!resolved) {
    throw new Error(`Unable to resolve ref: ${ref}`)
  }

  await client.send(
    'Runtime.callFunctionOn',
    {
      objectId: resolved.objectId,
      functionDeclaration: `function(value) {
        if (!this || this.tagName !== 'SELECT') {
          throw new Error('Element is not a select');
        }
        this.value = value;
        this.dispatchEvent(new Event('input', { bubbles: true }));
        this.dispatchEvent(new Event('change', { bubbles: true }));
        return this.value;
      }`,
      arguments: [{ value }],
      returnByValue: true,
    },
    sessionId,
  )
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
