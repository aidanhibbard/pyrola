import type { ModelRef } from '@/types/models/model-ref'
import { MODEL_REF_SEPARATOR } from '@/types/models/model-ref'

export default (value: string): ModelRef | null => {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const separatorIndex = trimmed.indexOf(MODEL_REF_SEPARATOR)
  if (separatorIndex > 0) {
    const providerId = trimmed.slice(0, separatorIndex)
    const modelId = trimmed.slice(separatorIndex + MODEL_REF_SEPARATOR.length)
    if (providerId && modelId) {
      return { providerId, modelId }
    }
  }

  return null
}
