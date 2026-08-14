import type { ProviderModelGroup } from '@/types/models/provider-model-group'
import isStrongProviderMatch from './is-strong-provider-match'
import normalizeSearchText from './normalize'

/** Keep groups whose providerId or providerName strongly match the provider string. */
const filterByProvider = (
  groups: ProviderModelGroup[],
  provider: string,
): ProviderModelGroup[] => {
  const normalized = normalizeSearchText(provider.trim())
  if (!normalized) {
    return []
  }
  return groups.filter((group) => isStrongProviderMatch(group, normalized))
}

export default filterByProvider
