import humanizeModelId from '@/utils/humanize-model-id'

export const modelVendorId = (modelId: string): string => {
  const slash = modelId.indexOf('/')
  if (slash <= 0) {
    return 'other'
  }
  return modelId.slice(0, slash).toLowerCase()
}

export const modelVendorLabel = (modelId: string): string => {
  const vendor = modelVendorId(modelId)
  if (vendor === 'other') {
    return 'Other'
  }
  return humanizeModelId(vendor)
}

export const modelShortId = (modelId: string): string => {
  const slash = modelId.lastIndexOf('/')
  if (slash >= 0 && slash < modelId.length - 1) {
    return modelId.slice(slash + 1)
  }
  return modelId
}

export default modelVendorLabel
