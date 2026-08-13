import type { ScoredProviderModelMatch } from '@/types/models/scored-provider-model-match'
import type { ScoredVendorGroup } from '@/types/models/scored-vendor-group'
import { modelVendorId, modelVendorLabel } from '@/utils/model-vendor'
import toScoredVendorModelEntries from './to-scored-vendor-model-entries'

/**
 * Regroup scored matches by model vendor. Models within each group keep
 * score-desc order; groups sort by best child score desc, then name.
 */
const regroupScoredVendorModels = (
  matches: ScoredProviderModelMatch[],
): ScoredVendorGroup[] => {
  const entries = toScoredVendorModelEntries(matches)
  const byVendor = new Map<string, ScoredVendorGroup>()

  for (const entry of entries) {
    const vendorId = modelVendorId(entry.modelId)
    const existing = byVendor.get(vendorId)
    if (existing) {
      existing.models.push(entry)
      continue
    }
    byVendor.set(vendorId, {
      vendorId,
      name: modelVendorLabel(entry.modelId),
      models: [entry],
    })
  }

  return [...byVendor.values()].sort((left, right) => {
    const leftBest = left.models[0]?.score ?? 0
    const rightBest = right.models[0]?.score ?? 0
    if (rightBest !== leftBest) {
      return rightBest - leftBest
    }
    return left.name.localeCompare(right.name)
  })
}

export default regroupScoredVendorModels
