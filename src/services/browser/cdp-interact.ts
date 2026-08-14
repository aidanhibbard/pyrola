import type CdpClient from '@/services/browser/cdp-client'
import { boxCenter, getBoxModelForObject } from '@/services/browser/cdp-geometry'
import {
  dispatchClickAt,
  evaluateBoolean,
  keyDefinition,
  type ClickOptions,
} from '@/services/browser/cdp-input-helpers'
import { resolveRef } from '@/services/browser/cdp-snapshot'

export { getBoundingBox, highlight } from '@/services/browser/cdp-geometry'

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

export const clickAtPoint = async (
  client: CdpClient,
  sessionId: string,
  x: number,
  y: number,
  options: ClickOptions = {},
): Promise<void> => {
  await dispatchClickAt(client, sessionId, { x, y }, options)
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

type TypeOptions = {
  clear?: boolean
  slowly?: boolean
  submit?: boolean
}

const typeText = async (
  client: CdpClient,
  sessionId: string,
  text: string,
  slowly: boolean,
): Promise<void> => {
  if (!slowly) {
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

export const type = async (
  client: CdpClient,
  sessionId: string,
  ref: string,
  text: string,
  options: TypeOptions = {},
): Promise<void> => {
  const resolved = await resolveRef(client, sessionId, ref)
  if (!resolved) {
    throw new Error(`Unable to resolve ref: ${ref}`)
  }

  await click(client, sessionId, ref)

  if (options.clear) {
    const selectModifier =
      typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
        ? 4
        : 2
    await pressKey(client, sessionId, 'a', selectModifier)
    await pressKey(client, sessionId, 'Backspace')
  }

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

  await typeText(client, sessionId, text, Boolean(options.slowly) || isRichText)

  if (options.submit) {
    await pressKey(client, sessionId, 'Enter')
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
