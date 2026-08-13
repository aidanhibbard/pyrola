import type { ParsedContentType } from '@/types/harness/web-content'

/**
 * Parse a Content-Type header into type/subtype, ignoring parameters.
 * `text/markdown; charset=utf-8` -> mediaType `text/markdown`.
 */
const parseContentType = (contentType: string): ParsedContentType | null => {
  const first = contentType.trim().split(';')[0]?.trim().toLowerCase() ?? ''
  if (!first.includes('/')) {
    return null
  }
  const slash = first.indexOf('/')
  const type = first.slice(0, slash).trim()
  const subtype = first.slice(slash + 1).trim()
  if (!type || !subtype) {
    return null
  }
  return {
    type,
    subtype,
    mediaType: `${type}/${subtype}`,
  }
}

export default parseContentType
