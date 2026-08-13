import type { ModelRef } from '@/types/models/model-ref'
import type { ProviderModelGroup } from '@/types/models/provider-model-group'

export type ScoredProviderModelMatch = {
  group: ProviderModelGroup
  model: ModelRef
  score: number
}
