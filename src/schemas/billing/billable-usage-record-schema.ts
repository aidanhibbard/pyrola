import { z } from 'zod'
import modelPricingRatesSchema from '@/schemas/billing/model-pricing-rates-schema'

const billableUsageRecordSchema = z.object({
  id: z.string().min(1),
  chatId: z.string().min(1),
  turnId: z.string().min(1),
  at: z.string().min(1),
  source: z.enum(['main', 'subagent', 'compaction', 'title', 'other']),
  subagentId: z.string().min(1).optional(),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  usage: z.object({
    inputTokens: z.number().optional(),
    noCacheTokens: z.number().optional(),
    cacheReadTokens: z.number().optional(),
    cacheWriteTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    reasoningTokens: z.number().optional(),
    textTokens: z.number().optional(),
    totalTokens: z.number().optional(),
    raw: z.unknown().optional(),
  }),
  providerMetadata: z.unknown().optional(),
  responseId: z.string().min(1).optional(),
  generationId: z.string().min(1).optional(),
  usageMissing: z.boolean().optional(),
  costUSD: z.number().nullable(),
  pricingSource: z.enum([
    'provider_reported',
    'user_configured',
    'catalog_estimate',
    'none',
  ]),
  rates: modelPricingRatesSchema.optional(),
})

export default billableUsageRecordSchema
