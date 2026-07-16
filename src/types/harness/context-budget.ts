import type { ContextBucket } from '@/types/harness/context-bucket'

export type ContextBudget = {
  modelId: string
  used: number
  limit: number
  buckets: ContextBucket[]
}
