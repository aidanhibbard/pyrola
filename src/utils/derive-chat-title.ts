const DEFAULT_CHAT_TITLES = new Set(['New Agent', 'New Chat'])

export const isDefaultChatTitle = (title: string): boolean =>
  DEFAULT_CHAT_TITLES.has(title.trim())

export default (text: string): string => {
  const line = text.trim().split('\n')[0]?.trim() ?? ''
  if (!line) {
    return ''
  }
  return line.length > 80 ? `${line.slice(0, 77)}…` : line
}
