import type { MentionHighlight } from '@/types/chat/mention-highlight'
import type { ContextMention } from '@/types/harness/context-mention'
import contextMentionDisplayToken from '@/utils/context-mention-display-token'

const isSkillTokenBoundary = (
  text: string,
  index: number,
  tokenLength: number,
): boolean => {
  const after = index + tokenLength
  if (after >= text.length) {
    return true
  }
  const next = text[after]
  // Avoid matching /ask inside /asking or /ask/foo paths.
  return next === undefined || !/[A-Za-z0-9_/-]/.test(next)
}

export default (
  text: string,
  mentions: ContextMention[],
  skillNames: string[],
): MentionHighlight[] => {
  const byToken = new Map<string, MentionHighlight>()

  for (const mention of mentions) {
    const highlight = contextMentionDisplayToken(mention)
    byToken.set(highlight.token, highlight)
  }

  const names = [...skillNames].sort((left, right) => right.length - left.length)
  for (const name of names) {
    const trimmed = name.trim()
    if (!trimmed) {
      continue
    }
    const token = `/${trimmed}`
    let from = 0
    while (from < text.length) {
      const index = text.indexOf(token, from)
      if (index < 0) {
        break
      }
      if (isSkillTokenBoundary(text, index, token.length)) {
        byToken.set(token, { kind: 'skill', token })
        break
      }
      from = index + token.length
    }
  }

  return [...byToken.values()]
}
