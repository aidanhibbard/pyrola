import type CdpClient from '@/services/browser/cdp-client'

type ClickOptions = {
  doubleClick?: boolean
  button?: 'left' | 'right' | 'middle'
  offsetX?: number
  offsetY?: number
  modifiers?: number
  holdDurationMs?: number
}

export type { ClickOptions }

export const mouseButton = (
  button: ClickOptions['button'],
): { button: string; buttons: number } => {
  switch (button) {
    case 'right':
      return { button: 'right', buttons: 2 }
    case 'middle':
      return { button: 'middle', buttons: 4 }
    case 'left':
    default:
      return { button: 'left', buttons: 1 }
  }
}

export const keyDefinition = (
  key: string,
): { key: string; code: string; text?: string; windowsVirtualKeyCode: number } => {
  const map: Record<string, { key: string; code: string; text?: string; windowsVirtualKeyCode: number }> = {
    Enter: { key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 },
    Tab: { key: 'Tab', code: 'Tab', text: '\t', windowsVirtualKeyCode: 9 },
    Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
    Backspace: { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 },
    Delete: { key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 },
    ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 },
    ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 },
    ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
    ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 },
    Home: { key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 },
    End: { key: 'End', code: 'End', windowsVirtualKeyCode: 35 },
    PageUp: { key: 'PageUp', code: 'PageUp', windowsVirtualKeyCode: 33 },
    PageDown: { key: 'PageDown', code: 'PageDown', windowsVirtualKeyCode: 34 },
    Space: { key: ' ', code: 'Space', text: ' ', windowsVirtualKeyCode: 32 },
    Meta: { key: 'Meta', code: 'MetaLeft', windowsVirtualKeyCode: 91 },
    Control: { key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17 },
    Alt: { key: 'Alt', code: 'AltLeft', windowsVirtualKeyCode: 18 },
    Shift: { key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 },
    a: { key: 'a', code: 'KeyA', text: 'a', windowsVirtualKeyCode: 65 },
    A: { key: 'A', code: 'KeyA', text: 'A', windowsVirtualKeyCode: 65 },
  }

  const known = map[key]
  if (known) {
    return known
  }

  if (key.length === 1) {
    const upper = key.toUpperCase()
    const code =
      upper >= 'A' && upper <= 'Z'
        ? `Key${upper}`
        : upper >= '0' && upper <= '9'
          ? `Digit${upper}`
          : `Key${upper}`
    return {
      key,
      code,
      text: key,
      windowsVirtualKeyCode: upper.charCodeAt(0),
    }
  }

  return {
    key,
    code: key,
    windowsVirtualKeyCode: 0,
  }
}

export const modifierMask = (modifiers: string[] | undefined): number => {
  if (!modifiers || modifiers.length === 0) {
    return 0
  }
  let mask = 0
  for (const name of modifiers) {
    switch (name.toLowerCase()) {
      case 'alt':
        mask |= 1
        break
      case 'ctrl':
      case 'control':
        mask |= 2
        break
      case 'meta':
      case 'command':
        mask |= 4
        break
      case 'shift':
        mask |= 8
        break
      default:
        break
    }
  }
  return mask
}

export const dispatchClickAt = async (
  client: CdpClient,
  sessionId: string,
  point: { x: number; y: number },
  options: ClickOptions = {},
): Promise<void> => {
  const { button, buttons } = mouseButton(options.button)
  const modifiers = options.modifiers ?? 0
  const clickCount = options.doubleClick ? 2 : 1

  await client.send(
    'Input.dispatchMouseEvent',
    {
      type: 'mousePressed',
      x: point.x,
      y: point.y,
      button,
      buttons,
      clickCount,
      modifiers,
    },
    sessionId,
  )
  if (options.holdDurationMs && options.holdDurationMs > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, options.holdDurationMs)
    })
  }
  await client.send(
    'Input.dispatchMouseEvent',
    {
      type: 'mouseReleased',
      x: point.x,
      y: point.y,
      button,
      buttons: 0,
      clickCount,
      modifiers,
    },
    sessionId,
  )
}

export const evaluateBoolean = async (
  client: CdpClient,
  sessionId: string,
  objectId: string,
  expression: string,
): Promise<boolean> => {
  const result = (await client.send(
    'Runtime.callFunctionOn',
    {
      objectId,
      functionDeclaration: expression,
      returnByValue: true,
    },
    sessionId,
  )) as { result?: { value?: unknown } }
  return result.result?.value === true
}
