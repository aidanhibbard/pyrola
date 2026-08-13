import normalizeSearchText from './normalize'

/**
 * Exact, prefix, or all-token match. Rejects weak mid-string substrings
 * (e.g. query "ai" must not match "openai").
 */
const isStrongFieldMatch = (field: string, query: string): boolean => {
  const normalizedField = normalizeSearchText(field)
  if (!normalizedField || !query) {
    return false
  }
  if (normalizedField === query) {
    return true
  }
  if (normalizedField.startsWith(`${query} `)) {
    return true
  }
  const fieldHasSpaces = normalizedField.includes(' ')
  const queryHasSpaces = query.includes(' ')
  if (!fieldHasSpaces && !queryHasSpaces && normalizedField.startsWith(query)) {
    return true
  }
  const fieldTokens = normalizedField.split(' ').filter((token) => token.length > 0)
  const queryTokens = query.split(' ').filter((token) => token.length > 0)
  if (queryTokens.length === 0) {
    return false
  }
  return queryTokens.every((token) => fieldTokens.includes(token))
}

export default isStrongFieldMatch
