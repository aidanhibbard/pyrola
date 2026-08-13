import type {
  TruncateWebTextInput,
  TruncateWebTextResult,
} from '@/types/harness/web-content'

/**
 * Slice text for agent context. Generic helper; callers choose maxLength
 * (web_fetch defaults to 32000 later).
 */
const truncateWebText = ({
  text,
  maxLength,
  startIndex = 0,
}: TruncateWebTextInput): TruncateWebTextResult => {
  const start = Math.max(0, Math.floor(startIndex))
  const limit = Math.max(0, Math.floor(maxLength))

  if (start >= text.length) {
    return { text: '', truncated: false }
  }

  const slice = text.slice(start)
  if (slice.length <= limit) {
    return { text: slice, truncated: false }
  }

  return {
    text: slice.slice(0, limit),
    truncated: true,
    nextStartIndex: start + limit,
  }
}

export default truncateWebText
