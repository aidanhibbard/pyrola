import type { BillableUsageRecord } from '@/types/billing/billable-usage-record'

export type TurnUsageAggregate = {
  turnId: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUSD: number | null
  pricingComplete: boolean
  usageMissing: boolean
  parts: BillableUsageRecord[]
}
