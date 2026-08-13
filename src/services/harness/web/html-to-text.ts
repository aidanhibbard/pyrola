import { parseHTML } from 'linkedom'

const SKIP_TAGS = ['script', 'style', 'noscript', 'iframe'] as const

/** Extract visible text from HTML, skipping non-content tags. */
const htmlToText = (html: string): string => {
  const { document } = parseHTML(html)
  for (const tag of SKIP_TAGS) {
    for (const el of Array.from(document.querySelectorAll(tag))) {
      el.remove()
    }
  }
  const raw =
    document.body?.textContent ??
    document.documentElement?.textContent ??
    ''
  return raw.replace(/\s+/g, ' ').trim()
}

export default htmlToText
