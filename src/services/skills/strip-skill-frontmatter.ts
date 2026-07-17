export const MAX_SKILL_CONTENT_CHARS = 4000

export default (content: string): { body: string; frontmatter: Record<string, string> } => {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: content.trim() }
  }

  const frontmatter: Record<string, string> = {}
  for (const line of (match[1] ?? '').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const colon = trimmed.indexOf(':')
    if (colon === -1) {
      continue
    }
    const key = trimmed.slice(0, colon).trim()
    let value = trimmed.slice(colon + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (value.startsWith('>-') || value.startsWith('|')) {
      continue
    }
    frontmatter[key] = value
  }

  return { frontmatter, body: (match[2] ?? '').trim() }
}
