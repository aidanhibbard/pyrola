import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import TurndownService from 'turndown'
import stripHtml from '@/services/harness/web/strip-html'

type ReadabilityArticle = {
  title?: string | null
  content?: string | null
  textContent?: string | null
}

const normalizeWhitespace = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * OpenClaw #20442: title-only / empty extracts must not count as success.
 * Short body text relative to the title falls back to full-page Turndown.
 */
const isEmptyOrTitleOnly = (article: ReadabilityArticle): boolean => {
  const text = normalizeWhitespace(article.textContent ?? '')
  if (!text) {
    return true
  }
  const title = normalizeWhitespace(article.title ?? '')
  if (title && text === title) {
    return true
  }
  if (text.length < 50) {
    return true
  }
  if (title && text.length <= title.length + 8 && text.includes(title)) {
    return true
  }
  return false
}

const createTurndown = (): TurndownService => {
  const service = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
  })
  service.remove(['script', 'style', 'meta', 'link'])
  return service
}

/**
 * HTML to markdown: strip chrome tags, try Mozilla Readability, then Turndown.
 * Falls back to Turndown of the full stripped HTML when Readability is null,
 * empty, or title-only.
 */
const htmlToMarkdown = (html: string): string => {
  const stripped = stripHtml(html)
  const { document } = parseHTML(stripped)
  const turndown = createTurndown()

  let article: ReadabilityArticle | null = null
  try {
    article = new Readability(document as unknown as Document).parse()
  } catch {
    article = null
  }

  if (article?.content && !isEmptyOrTitleOnly(article)) {
    return turndown.turndown(article.content).trim()
  }

  return turndown.turndown(stripped).trim()
}

export default htmlToMarkdown
