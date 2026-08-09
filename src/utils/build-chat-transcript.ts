import type { UIMessage } from 'ai'

const serializeMessageText = (message: UIMessage): string =>
  message.parts
    .map((part) => {
      if (part.type === 'text' || part.type === 'reasoning') {
        return part.text
      }
      return JSON.stringify(part)
    })
    .join('\n')
    .trim()

export default (messages: UIMessage[]): string => {
  if (messages.length === 0) {
    return '(empty conversation)'
  }

  return messages
    .map((message) => {
      const body = serializeMessageText(message)
      return `${message.role.toUpperCase()}:\n${body || '(empty)'}`
    })
    .join('\n\n')
}
