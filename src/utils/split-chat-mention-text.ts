import type { MentionHighlight } from '@/types/chat/mention-highlight'

type ChatMentionTextSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string }
  | { type: 'skill'; value: string }

type MatchedHighlight = {
  index: number
  highlight: MentionHighlight
}

const findNextHighlight = (
  text: string,
  fromIndex: number,
  highlights: MentionHighlight[],
): MatchedHighlight | null => {
  let best: MatchedHighlight | null = null

  for (const highlight of highlights) {
    const index = text.indexOf(highlight.token, fromIndex)
    if (index < 0) {
      continue
    }
    if (
      !best ||
      index < best.index ||
      (index === best.index && highlight.token.length > best.highlight.token.length)
    ) {
      best = { index, highlight }
    }
  }

  return best
}

export default (
  text: string,
  highlights: MentionHighlight[] = [],
): ChatMentionTextSegment[] => {
  if (!text) {
    return []
  }

  if (highlights.length === 0) {
    return [{ type: 'text', value: text }]
  }

  const segments: ChatMentionTextSegment[] = []
  let cursor = 0

  while (cursor < text.length) {
    const match = findNextHighlight(text, cursor, highlights)
    if (!match) {
      segments.push({ type: 'text', value: text.slice(cursor) })
      break
    }

    if (match.index > cursor) {
      segments.push({ type: 'text', value: text.slice(cursor, match.index) })
    }

    segments.push({
      type: match.highlight.kind,
      value: match.highlight.token,
    })
    cursor = match.index + match.highlight.token.length
  }

  return segments
}
