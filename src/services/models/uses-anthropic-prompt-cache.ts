import type { ModelRef } from '@/types/models/model-ref'
import { modelVendorId } from '@/utils/model-vendor'

/**
 * Native Anthropic and routers that forward providerOptions.anthropic
 * (AI Gateway Claude slugs).
 */
export default (ref: ModelRef): boolean => {
  if (ref.providerId === 'anthropic') {
    return true
  }
  return ref.providerId === 'gateway' && modelVendorId(ref.modelId) === 'anthropic'
}
