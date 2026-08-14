import isShortcutTypingTarget from './is-shortcut-typing-target'

type AppShortcutAction = 'toggle-palette' | 'new-agent' | 'toggle-right-sidebar'

export default (event: KeyboardEvent): AppShortcutAction | null => {
  if (!(event.metaKey || event.ctrlKey)) {
    return null
  }

  const key = event.key.toLowerCase()

  if (key === 'k') {
    return 'toggle-palette'
  }

  if (isShortcutTypingTarget(event.target)) {
    return null
  }

  if (key === 'n' && !event.shiftKey && !event.altKey) {
    return 'new-agent'
  }

  if (key === 'b' && event.shiftKey) {
    return 'toggle-right-sidebar'
  }

  return null
}
