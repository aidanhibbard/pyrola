import type { ModelRef } from '@/types/models/model-ref'
import type { ProviderModelGroup } from '@/types/models/provider-model-group'
import filterScoredProviderModels from './filter-scored-provider-models'

/** Filter provider groups by query, preserving provider grouping without scores. */
const filterProviderModelGroups = (
  groups: ProviderModelGroup[],
  query: string,
): ProviderModelGroup[] => {
  const trimmed = query.trim()
  if (!trimmed) {
    return groups
  }

  const matches = filterScoredProviderModels(groups, query)
  if (matches.length === 0) {
    return []
  }

  const orderedProviderIds: string[] = []
  const modelsByProvider = new Map<string, ModelRef[]>()
  const groupByProvider = new Map<string, ProviderModelGroup>()

  for (const match of matches) {
    const providerId = match.group.providerId
    if (!groupByProvider.has(providerId)) {
      groupByProvider.set(providerId, match.group)
      orderedProviderIds.push(providerId)
      modelsByProvider.set(providerId, [])
    }
    modelsByProvider.get(providerId)?.push(match.model)
  }

  return orderedProviderIds.map((providerId) => {
    const group = groupByProvider.get(providerId)
    const models = modelsByProvider.get(providerId) ?? []
    return {
      providerId,
      providerName: group?.providerName ?? providerId,
      models,
    }
  })
}

export default filterProviderModelGroups
