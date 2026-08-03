import type { ContextBucket } from '@/types/harness/context-bucket'

export type ContextBudget = {
  modelId: string
  limit: number
  promptUsed: number
  reservedOutput: number
  safetyBuffer: number
  free: number
  used: number
  buckets: ContextBucket[]
}
