import type { ModelRef } from '@/types/models/model-ref'
import { MODEL_REF_SEPARATOR } from '@/types/models/model-ref'

export default (ref: ModelRef): string =>
  `${ref.providerId}${MODEL_REF_SEPARATOR}${ref.modelId}`
