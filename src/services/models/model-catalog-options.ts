import type {
  ModelCatalogOption,
  ModelCatalogOptionsMap,
} from '@/types/models/model-catalog-option'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import serializeModelRef from '@/utils/serialize-model-ref'
import type { ModelRef } from '@/types/models/model-ref'

export const getModelCatalogOptionsMap = (
  settings: PyrolaSettings,
): ModelCatalogOptionsMap => {
  const raw = settings['models.catalogOptions']
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }
  return raw as ModelCatalogOptionsMap
}

export const getModelCatalogOption = (
  settings: PyrolaSettings,
  ref: ModelRef | string,
): ModelCatalogOption => {
  const key =
    typeof ref === 'string'
      ? ref
      : serializeModelRef({ providerId: ref.providerId, modelId: ref.modelId })
  return getModelCatalogOptionsMap(settings)[key] ?? {}
}

export const isModelAllowed = (
  settings: PyrolaSettings,
  ref: ModelRef | string,
): boolean => getModelCatalogOption(settings, ref).allowed !== false

export const mergeModelCatalogOption = (
  settings: PyrolaSettings,
  ref: ModelRef | string,
  patch: ModelCatalogOption,
): ModelCatalogOptionsMap => {
  const key =
    typeof ref === 'string'
      ? ref
      : serializeModelRef({ providerId: ref.providerId, modelId: ref.modelId })
  const current = getModelCatalogOptionsMap(settings)
  const next: ModelCatalogOption = { ...current[key] }

  for (const [field, value] of Object.entries(patch) as Array<
    [keyof ModelCatalogOption, ModelCatalogOption[keyof ModelCatalogOption]]
  >) {
    if (value === undefined) {
      delete next[field]
      continue
    }
    next[field] = value as never
  }

  if (next.reasoning === 'provider-default') {
    delete next.reasoning
  }
  if (next.allowed === true) {
    delete next.allowed
  }
  if (next.fast === false) {
    delete next.fast
  }

  const map = { ...current }
  if (Object.keys(next).length === 0) {
    delete map[key]
  } else {
    map[key] = next
  }
  return map
}

export default getModelCatalogOption
