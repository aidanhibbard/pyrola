import { describe, expect, it } from 'vitest'
import isShortcutTypingTarget from '@/utils/keyboard/is-shortcut-typing-target'

describe('isShortcutTypingTarget', () => {
  it('returns false for null and non-elements', () => {
    expect(isShortcutTypingTarget(null)).toBe(false)
    expect(isShortcutTypingTarget(window)).toBe(false)
  })

  it('returns true for inputs, textareas, selects, and contenteditable', () => {
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const select = document.createElement('select')
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    document.body.append(editable)

    expect(isShortcutTypingTarget(input)).toBe(true)
    expect(isShortcutTypingTarget(textarea)).toBe(true)
    expect(isShortcutTypingTarget(select)).toBe(true)
    expect(isShortcutTypingTarget(editable)).toBe(true)
    editable.remove()
  })

  it('returns true for monaco and xterm descendants', () => {
    const monaco = document.createElement('div')
    monaco.className = 'monaco-editor'
    const monacoChild = document.createElement('div')
    monaco.append(monacoChild)

    const xterm = document.createElement('div')
    xterm.className = 'xterm'
    const xtermChild = document.createElement('div')
    xterm.append(xtermChild)

    document.body.append(monaco, xterm)
    expect(isShortcutTypingTarget(monacoChild)).toBe(true)
    expect(isShortcutTypingTarget(xtermChild)).toBe(true)
    monaco.remove()
    xterm.remove()
  })

  it('returns false for ordinary elements', () => {
    expect(isShortcutTypingTarget(document.createElement('button'))).toBe(false)
  })
})
