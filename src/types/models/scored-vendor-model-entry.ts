import type { ModelRef } from '@/types/models/model-ref'

export type ScoredVendorModelEntry = ModelRef & {
  providerName: string
  label: string
  score: number
}
