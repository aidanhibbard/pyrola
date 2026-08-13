import { parseHTML } from 'linkedom'

const STRIP_TAGS = ['script', 'style', 'meta', 'link'] as const

/**
 * Remove script/style/meta/link from HTML. Returns serialized markup
 * suitable for Turndown or format=html passthrough.
 */
const stripHtml = (html: string): string => {
  const { document } = parseHTML(html)
  for (const tag of STRIP_TAGS) {
    for (const el of Array.from(document.querySelectorAll(tag))) {
      el.remove()
    }
  }
  const root = document.documentElement
  if (root) {
    return root.outerHTML
  }
  return document.toString()
}

export default stripHtml
