import type { ModelPricingRates } from '@/types/billing/model-pricing-rates'
import type { PricingSource } from '@/types/billing/pricing-source'

export type BillableUsageRecord = {
  id: string
  chatId: string
  turnId: string
  at: string
  source: 'main' | 'subagent' | 'compaction' | 'title' | 'other'
  subagentId?: string
  providerId: string
  modelId: string
  usage: {
    inputTokens?: number
    noCacheTokens?: number
    cacheReadTokens?: number
    cacheWriteTokens?: number
    outputTokens?: number
    reasoningTokens?: number
    textTokens?: number
    totalTokens?: number
    raw?: unknown
  }
  providerMetadata?: unknown
  responseId?: string
  generationId?: string
  usageMissing?: boolean
  costUSD: number | null
  pricingSource: PricingSource
  rates?: ModelPricingRates
}
