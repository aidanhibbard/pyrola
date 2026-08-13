type SpaShellInput = {
  html: string
  text: string
  title?: string
}

const SPA_ROOT_RE =
  /<(?:div|main|section|app)[^>]*\bid\s*=\s*["']?(?:app|root|__next)["']?/i

const TINY_TEXT_LIMIT = 80

/**
 * Heuristic: JS app shells with almost no article text.
 * Conservative on real docs; flags empty #app / #root / #__next pages.
 */
const isSpaShell = ({ html, text, title }: SpaShellInput): boolean => {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const normalizedTitle = (title ?? '').replace(/\s+/g, ' ').trim()

  if (!normalized) {
    return true
  }
  if (normalizedTitle && normalized === normalizedTitle) {
    return true
  }
  if (normalized.length < TINY_TEXT_LIMIT && SPA_ROOT_RE.test(html)) {
    return true
  }
  return false
}

export default isSpaShell
