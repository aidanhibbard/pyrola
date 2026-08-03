import type { ModelRef } from '@/types/models/model-ref'
import { getProviderCatalogEntry } from '@/services/providers/registry'

const shortModelId = (modelId: string): string => {
  const slashIndex = modelId.lastIndexOf('/')
  if (slashIndex >= 0 && slashIndex < modelId.length - 1) {
    return modelId.slice(slashIndex + 1)
  }
  return modelId
}

export default (ref: ModelRef, customProviderName?: string): string => {
  const providerName =
    customProviderName ?? getProviderCatalogEntry(ref.providerId)?.name ?? ref.providerId
  const modelLabel = ref.name?.trim() || shortModelId(ref.modelId)
  return `${providerName} / ${modelLabel}`
}
