const DEFAULT_CHAT_TITLES = new Set(['New Agent', 'New Chat'])

const MAX_FALLBACK_WORDS = 6
const MAX_FALLBACK_CHARS = 40

export const isDefaultChatTitle = (title: string): boolean =>
  DEFAULT_CHAT_TITLES.has(title.trim())

const normalizeForCompare = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** True when a candidate title is just the start of the user prompt. */
export const isPromptEchoTitle = (title: string, prompt: string): boolean => {
  const t = normalizeForCompare(title)
  const p = normalizeForCompare(prompt)
  if (!t || !p) {
    return true
  }
  if (p.startsWith(t)) {
    return true
  }

  const titleWords = t.split(' ')
  const promptWords = p.split(' ')
  if (titleWords.length < 3) {
    return false
  }
  return titleWords.every((word, index) => promptWords[index] === word)
}

/** Short last-resort title from the first line (not the full prompt). */
export default (text: string): string => {
  const line = text.trim().split('\n')[0]?.trim() ?? ''
  if (!line) {
    return ''
  }

  const words = line.split(/\s+/).filter(Boolean).slice(0, MAX_FALLBACK_WORDS)
  let title = words.join(' ')
  if (title.length > MAX_FALLBACK_CHARS) {
    title = `${title.slice(0, MAX_FALLBACK_CHARS - 1)}…`
  }
  return title
}
