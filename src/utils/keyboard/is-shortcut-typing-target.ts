const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export default (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (
    target.isContentEditable
    || target.contentEditable === 'true'
    || target.closest('[contenteditable="true"], [contenteditable=""]')
  ) {
    return true
  }

  if (TYPING_TAGS.has(target.tagName)) {
    return true
  }

  return Boolean(target.closest('.monaco-editor, .monaco-diff-editor, .xterm'))
}
