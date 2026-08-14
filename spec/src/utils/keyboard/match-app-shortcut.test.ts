import { describe, expect, it } from 'vitest'
import matchAppShortcut from '@/utils/keyboard/match-app-shortcut'
import appShortcutHelp from '@/utils/keyboard/app-shortcut-help'

const chord = (
  key: string,
  init: KeyboardEventInit,
  target?: HTMLElement,
): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, ...init })
  if (target) {
    Object.defineProperty(event, 'target', { value: target })
  }
  return event
}

describe('matchAppShortcut', () => {
  it('binds Cmd/Ctrl+K to the command palette even while typing', () => {
    const input = document.createElement('input')
    expect(matchAppShortcut(chord('k', { metaKey: true }))).toBe('toggle-palette')
    expect(matchAppShortcut(chord('K', { ctrlKey: true }, input))).toBe(
      'toggle-palette',
    )
  })

  it('binds Cmd/Ctrl+N to new agent', () => {
    expect(matchAppShortcut(chord('n', { metaKey: true }))).toBe('new-agent')
    expect(matchAppShortcut(chord('N', { ctrlKey: true }))).toBe('new-agent')
  })

  it('binds Cmd/Ctrl+Shift+B to toggle the right workbench', () => {
    expect(matchAppShortcut(chord('b', { metaKey: true, shiftKey: true }))).toBe(
      'toggle-right-sidebar',
    )
    expect(matchAppShortcut(chord('B', { ctrlKey: true, shiftKey: true }))).toBe(
      'toggle-right-sidebar',
    )
  })

  it('does not steal Cmd/Ctrl+N or Cmd/Ctrl+Shift+B from inputs, monaco, or xterm', () => {
    const input = document.createElement('input')
    const monaco = document.createElement('div')
    monaco.className = 'monaco-editor'
    const monacoChild = document.createElement('div')
    monaco.append(monacoChild)
    const xterm = document.createElement('div')
    xterm.className = 'xterm'
    const xtermChild = document.createElement('textarea')
    xterm.append(xtermChild)
    document.body.append(monaco, xterm)

    expect(matchAppShortcut(chord('n', { metaKey: true }, input))).toBe(null)
    expect(matchAppShortcut(chord('n', { ctrlKey: true }, monacoChild))).toBe(null)
    expect(
      matchAppShortcut(chord('b', { metaKey: true, shiftKey: true }, xtermChild)),
    ).toBe(null)

    monaco.remove()
    xterm.remove()
  })

  it('does not bind leftover Ctrl+` or plain Cmd+B', () => {
    expect(matchAppShortcut(chord('`', { ctrlKey: true }))).toBe(null)
    expect(matchAppShortcut(chord('b', { metaKey: true }))).toBe(null)
  })
})

describe('appShortcutHelp', () => {
  it('lists the bound chords and omits a bottom terminal shortcut', () => {
    expect(appShortcutHelp.map((item) => item.keys)).toEqual([
      'Cmd/Ctrl+K',
      'Cmd/Ctrl+N',
      'Cmd/Ctrl+B',
      'Cmd/Ctrl+Shift+B',
      'Esc',
    ])
    expect(appShortcutHelp.some((item) => item.keys.includes('`'))).toBe(false)
  })
})
