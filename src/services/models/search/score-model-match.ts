import type { ModelRef } from '@/types/models/model-ref'
import type { ProviderModelGroup } from '@/types/models/provider-model-group'
import humanizeModelId from '@/utils/humanize-model-id'
import { modelShortId, modelVendorId } from '@/utils/model-vendor'
import isStrongFieldMatch from './is-strong-field-match'
import isStrongProviderMatch from './is-strong-provider-match'
import normalizeSearchText from './normalize'

const SCORE_EXACT = 100
const SCORE_STARTS_WITH = 80
const SCORE_ALL_TOKENS = 60
const SCORE_ID_SUBSTRING = 40
const SCORE_PROVIDER = 30
const SCORE_VENDOR = 20

type ScoreModelMatchInput = {
  group: ProviderModelGroup
  model: ModelRef
  query: string
}

const fieldStartsWithQuery = (field: string, query: string): boolean => {
  if (!field) {
    return false
  }
  return field === query || field.startsWith(`${query} `) || field.startsWith(query)
}

const allTokensInField = (field: string, tokens: string[]): boolean => {
  if (!field || tokens.length === 0) {
    return false
  }
  return tokens.every((token) => field.includes(token))
}

const idSubstringMatch = (field: string, query: string, tokens: string[]): boolean => {
  if (!field) {
    return false
  }
  // Short queries must hit whole tokens so "ai" does not match "openai".
  if (query.length < 3) {
    const fieldTokens = field.split(' ').filter((token) => token.length > 0)
    return tokens.every((token) => fieldTokens.includes(token))
  }
  return field.includes(query)
}

const scoreModelMatch = (input: ScoreModelMatchInput): number => {
  const { group, model, query } = input
  if (!query) {
    return 0
  }

  const shortId = modelShortId(model.modelId)
  const label = normalizeSearchText(humanizeModelId(shortId))
  const normalizedShortId = normalizeSearchText(shortId)
  const normalizedName = normalizeSearchText(model.name ?? '')
  const normalizedModelId = normalizeSearchText(model.modelId)
  const normalizedFastId = normalizeSearchText(model.fastModelId ?? '')
  const vendorId = modelVendorId(model.modelId)
  const tokens = query.split(' ').filter((token) => token.length > 0)

  let score = 0

  const modelFields = [label, normalizedShortId, normalizedName].filter(
    (field) => field.length > 0,
  )

  if (modelFields.some((field) => field === query)) {
    score = Math.max(score, SCORE_EXACT)
  }
  if (modelFields.some((field) => fieldStartsWithQuery(field, query))) {
    score = Math.max(score, SCORE_STARTS_WITH)
  }
  if (modelFields.some((field) => allTokensInField(field, tokens))) {
    score = Math.max(score, SCORE_ALL_TOKENS)
  }
  if (
    idSubstringMatch(normalizedModelId, query, tokens) ||
    idSubstringMatch(normalizedShortId, query, tokens) ||
    idSubstringMatch(normalizedFastId, query, tokens)
  ) {
    score = Math.max(score, SCORE_ID_SUBSTRING)
  }
  if (isStrongProviderMatch(group, query)) {
    score = Math.max(score, SCORE_PROVIDER)
  }
  if (vendorId !== 'other' && isStrongFieldMatch(vendorId, query)) {
    score = Math.max(score, SCORE_VENDOR)
  }

  return score
}

export default scoreModelMatch
