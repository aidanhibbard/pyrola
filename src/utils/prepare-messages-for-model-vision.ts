import type { UIMessage } from 'ai'
import decodeFilePartText from '@/utils/decode-file-part-text'

const attachmentPlaceholder = (
  filename: string | undefined,
  mediaType: string | undefined,
): string =>
  `[Attachment: ${filename || 'file'} (${mediaType || 'unknown'})]`

/**
 * Prepare UI messages for convertToModelMessages.
 * - image file parts pass through when the model supports vision; otherwise
 *   they become text placeholders
 * - non-image file parts always decode to text content so JSON payloads reach
 *   the model (without stuffing them into the composer textarea)
 * UI timeline messages keep their original file parts for display.
 */
export default async (
  messages: UIMessage[],
  supportsVision: boolean,
): Promise<UIMessage[]> => {
  return Promise.all(
    messages.map(async (message) => {
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

        const mediaType = part.mediaType || ''
        const filename = part.filename

        if (mediaType.startsWith('image/')) {
          if (supportsVision) {
            parts.push(part)
            continue
          }
          changed = true
          parts.push({
            type: 'text',
            text: attachmentPlaceholder(filename, mediaType),
          })
          continue
        }

        changed = true
        const decoded = await decodeFilePartText(part.url)
        if (decoded === null) {
          parts.push({
            type: 'text',
            text: attachmentPlaceholder(filename, mediaType || 'unknown'),
          })
          continue
        }

        parts.push({
          type: 'text',
          text: `Element payload (${filename || 'file'}):\n${decoded}`,
        })
      }

      if (!changed) {
        return message
      }

      return {
        ...message,
        parts,
      }
    }),
  )
}
