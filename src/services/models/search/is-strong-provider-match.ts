import type { ProviderModelGroup } from '@/types/models/provider-model-group'
import normalizeSearchText from './normalize'

/**
 * Exact or prefix match on provider name/id. Does not treat a short token
 * inside a multi-word name (e.g. "ai" in "Vercel AI Gateway") as strong.
 */
const isStrongProviderMatch = (
  group: ProviderModelGroup,
  query: string,
): boolean => {
  if (!query) {
    return false
  }

  const fields = [
    normalizeSearchText(group.providerName),
    normalizeSearchText(group.providerId),
  ].filter((field) => field.length > 0)

  for (const field of fields) {
    if (field === query) {
      return true
    }
    if (field.startsWith(`${query} `)) {
      return true
    }
    if (!query.includes(' ') && !field.includes(' ') && field.startsWith(query)) {
      return true
    }
  }

  return false
}

export default isStrongProviderMatch
