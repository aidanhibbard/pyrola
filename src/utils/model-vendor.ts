import humanizeModelId from '@/utils/humanize-model-id'

/** OpenRouter "latest" aliases use a leading ~ on the vendor (e.g. ~anthropic/...). */
export const stripModelAliasMarker = (modelId: string): string =>
  modelId.startsWith('~') ? modelId.slice(1) : modelId

export const modelVendorId = (modelId: string): string => {
  const normalized = stripModelAliasMarker(modelId.trim())
  const slash = normalized.indexOf('/')
  if (slash <= 0) {
    return 'other'
  }
  return normalized.slice(0, slash).toLowerCase()
}

export const modelVendorLabel = (modelId: string): string => {
  const vendor = modelVendorId(modelId)
  if (vendor === 'other') {
    return 'Other'
  }
  return humanizeModelId(vendor)
}

export const modelShortId = (modelId: string): string => {
  const normalized = stripModelAliasMarker(modelId)
  const slash = normalized.lastIndexOf('/')
  if (slash >= 0 && slash < normalized.length - 1) {
    return normalized.slice(slash + 1)
  }
  return normalized
}

export default modelVendorLabel
