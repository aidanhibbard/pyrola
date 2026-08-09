type ChatMentionTextSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string }
  | { type: 'skill'; value: string }

const TOKEN_PATTERN = /@[^\s]+|\/[A-Za-z][\w-]*/g

export default (text: string): ChatMentionTextSegment[] => {
  if (!text) {
    return []
  }

  const segments: ChatMentionTextSegment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, index) })
    }
    const value = match[0]
    segments.push({
      type: value.startsWith('/') ? 'skill' : 'mention',
      value,
    })
    lastIndex = index + value.length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return segments
}
