import type { UIMessage } from 'ai'

/**
 * Prepare UI messages for convertToModelMessages.
 * When the active model cannot consume images, replace file parts with text
 * placeholders so the model still sees attachment metadata without pixels.
 * UI timeline messages keep their original file parts for display.
 */
export default (
  messages: UIMessage[],
  supportsVision: boolean,
): UIMessage[] => {
  if (supportsVision) {
    return messages
  }

  return messages.map((message) => {
    if (message.role !== 'user') {
      return message
    }

    let changed = false
    const parts: UIMessage['parts'] = []

    for (const part of message.parts) {
      if (part.type !== 'file') {
        parts.push(part)
        continue
      }

      changed = true
      parts.push({
        type: 'text',
        text: `[Attachment: ${part.filename || 'file'} (${part.mediaType || 'unknown'})]`,
      })
    }

    if (!changed) {
      return message
    }

    return {
      ...message,
      parts,
    }
  })
}
