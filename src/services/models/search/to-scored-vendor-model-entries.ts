import type { ScoredProviderModelMatch } from '@/types/models/scored-provider-model-match'
import type { ScoredVendorModelEntry } from '@/types/models/scored-vendor-model-entry'
import humanizeModelId from '@/utils/humanize-model-id'
import { modelShortId } from '@/utils/model-vendor'

const compareEntries = (
  left: ScoredVendorModelEntry,
  right: ScoredVendorModelEntry,
): number => {
  if (right.score !== left.score) {
    return right.score - left.score
  }
  const byLabel = left.label.localeCompare(right.label)
  if (byLabel !== 0) {
    return byLabel
  }
  return left.providerName.localeCompare(right.providerName)
}

/**
 * Map scored provider matches to vendor list rows, sorted by score desc,
 * then label, then provider name.
 */
const toScoredVendorModelEntries = (
  matches: ScoredProviderModelMatch[],
): ScoredVendorModelEntry[] => {
  const entries: ScoredVendorModelEntry[] = matches.map((match) => ({
    ...match.model,
    providerName: match.group.providerName,
    label: humanizeModelId(modelShortId(match.model.modelId)),
    score: match.score,
  }))
  return entries.sort(compareEntries)
}

export default toScoredVendorModelEntries
