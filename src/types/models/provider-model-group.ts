import type { ModelRef } from '@/types/models/model-ref'

export type ProviderModelGroup = {
  providerId: string
  providerName: string
  models: ModelRef[]
}
