import type { ProviderModelGroup } from '@/types/models/provider-model-group'
import type { ScoredProviderModelMatch } from '@/types/models/scored-provider-model-match'
import humanizeModelId from '@/utils/humanize-model-id'
import { modelShortId } from '@/utils/model-vendor'
import normalizeSearchText from './normalize'
import scoreModelMatch from './score-model-match'

const modelSortLabel = (modelId: string, name?: string): string => {
  if (name && name.trim()) {
    return name.trim().toLowerCase()
  }
  return humanizeModelId(modelShortId(modelId)).toLowerCase()
}

const compareMatches = (
  left: ScoredProviderModelMatch,
  right: ScoredProviderModelMatch,
): number => {
  if (right.score !== left.score) {
    return right.score - left.score
  }
  const byLabel = modelSortLabel(left.model.modelId, left.model.name).localeCompare(
    modelSortLabel(right.model.modelId, right.model.name),
  )
  if (byLabel !== 0) {
    return byLabel
  }
  return left.group.providerName.localeCompare(right.group.providerName)
}

/**
 * Score catalog models against a search query. Higher score is better.
 * Empty query returns every model at score 0. Query "fast" keeps supportsFast models.
 */
const filterScoredProviderModels = (
  groups: ProviderModelGroup[],
  query: string,
): ScoredProviderModelMatch[] => {
  const trimmed = query.trim()
  if (!trimmed) {
    const all: ScoredProviderModelMatch[] = []
    for (const group of groups) {
      for (const model of group.models) {
        all.push({ group, model, score: 0 })
      }
    }
    return all.sort(compareMatches)
  }

  const wantsFast = trimmed.toLowerCase() === 'fast'
  if (wantsFast) {
    const fastMatches: ScoredProviderModelMatch[] = []
    for (const group of groups) {
      for (const model of group.models) {
        if (model.supportsFast === true) {
          fastMatches.push({ group, model, score: 1 })
        }
      }
    }
    return fastMatches.sort(compareMatches)
  }

  const normalizedQuery = normalizeSearchText(trimmed)
  if (!normalizedQuery) {
    return []
  }

  const matches: ScoredProviderModelMatch[] = []
  for (const group of groups) {
    for (const model of group.models) {
      const score = scoreModelMatch({
        group,
        model,
        query: normalizedQuery,
      })
      if (score > 0) {
        matches.push({ group, model, score })
      }
    }
  }

  return matches.sort(compareMatches)
}

export default filterScoredProviderModels
