import type {
  ConvertWebContentInput,
  ConvertWebContentOk,
  ConvertWebContentResult,
  WebContentKind,
} from '@/types/harness/web-content'
import htmlToMarkdown from '@/services/harness/web/html-to-markdown'
import htmlToText from '@/services/harness/web/html-to-text'
import isBinaryContentType from '@/services/harness/web/is-binary-content-type'
import isChallengePage from '@/services/harness/web/is-challenge-page'
import isSpaShell from '@/services/harness/web/is-spa-shell'
import looksLikeHtml from '@/services/harness/web/looks-like-html'
import parseContentType from '@/services/harness/web/parse-content-type'
import stripHtml from '@/services/harness/web/strip-html'

const PASSTHROUGH_TYPES = new Set([
  'text/plain',
  'application/json',
  'text/xml',
  'application/xml',
])

const HTML_TYPES = new Set(['text/html', 'application/xhtml+xml'])

const ok = (
  text: string,
  kind: WebContentKind,
  flags: { spaShell: boolean; challenge: boolean },
): ConvertWebContentOk => {
  return {
    ok: true,
    text,
    kind,
    spaShell: flags.spaShell,
    challenge: flags.challenge,
  }
}

const passthrough = (body: string): ConvertWebContentOk => {
  return ok(body, 'passthrough', { spaShell: false, challenge: false })
}

const convertHtml = (
  body: string,
  format: ConvertWebContentInput['format'],
): ConvertWebContentOk => {
  let text: string
  let kind: WebContentKind

  if (format === 'text') {
    text = htmlToText(body)
    kind = 'text'
  } else if (format === 'html') {
    text = stripHtml(body)
    kind = 'html'
  } else {
    text = htmlToMarkdown(body)
    kind = 'markdown'
  }

  return ok(text, kind, {
    spaShell: isSpaShell({ html: body, text }),
    challenge: isChallengePage({ html: body, text }),
  })
}

/**
 * Content-Type dispatch for web_fetch: native markdown pass-through,
 * text/json/xml pass-through, HTML conversion by format, binary errors.
 */
const convertWebContent = (
  input: ConvertWebContentInput,
): ConvertWebContentResult => {
  const parsed = parseContentType(input.contentType)
  const mediaType = parsed?.mediaType ?? ''

  if (mediaType && isBinaryContentType(mediaType)) {
    return {
      ok: false,
      error: `Unsupported Content-Type ${mediaType}: binary responses cannot be converted to text`,
    }
  }

  if (mediaType === 'text/markdown') {
    return ok(input.body, 'markdown', { spaShell: false, challenge: false })
  }

  if (PASSTHROUGH_TYPES.has(mediaType)) {
    return passthrough(input.body)
  }

  if (HTML_TYPES.has(mediaType)) {
    return convertHtml(input.body, input.format)
  }

  // text/x-markdown is not native markdown; HTML only if the body looks like it.
  if (mediaType === 'text/x-markdown') {
    if (looksLikeHtml(input.body)) {
      return convertHtml(input.body, input.format)
    }
    return passthrough(input.body)
  }

  // Missing or unknown Content-Type: HTML sniff, else passthrough.
  if (!mediaType || !parsed) {
    if (looksLikeHtml(input.body)) {
      return convertHtml(input.body, input.format)
    }
    return passthrough(input.body)
  }

  if (looksLikeHtml(input.body)) {
    return convertHtml(input.body, input.format)
  }

  return passthrough(input.body)
}

export default convertWebContent
