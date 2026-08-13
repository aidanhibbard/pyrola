import type { ScoredVendorModelEntry } from '@/types/models/scored-vendor-model-entry'

export type ScoredVendorGroup = {
  vendorId: string
  name: string
  models: ScoredVendorModelEntry[]
}
