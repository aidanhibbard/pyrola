import type { ModelPricingRates } from '@/types/billing/model-pricing-rates'
import type { BillableUsageRecord } from '@/types/billing/billable-usage-record'

type BillableUsageTokens = BillableUsageRecord['usage']

/**
 * Estimate USD cost from token usage and rates (per 1M tokens).
 *
 * Exclusive cache math: uncached input is billed at inputPerMillion; cache read
 * and cache write use their own rates and are not also charged as input.
 *
 * Reasoning: AI SDK providers that report reasoningTokens typically fold them
 * into outputTokens (e.g. Google thoughts, OpenAI-compatible completion totals).
 * Only add a separate reasoning charge when reasoningPerMillion is set AND
 * reasoningTokens is clearly outside outputTokens (textTokens === outputTokens
 * while reasoningTokens > 0). Otherwise do not double-bill.
 */
export default (usage: BillableUsageTokens, rates: ModelPricingRates): number => {
  const inputTokens = usage.inputTokens ?? 0
  const cacheReadTokens = usage.cacheReadTokens ?? 0
  const cacheWriteTokens = usage.cacheWriteTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0
  const reasoningTokens = usage.reasoningTokens ?? 0

  const uncached =
    usage.noCacheTokens ??
    Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens)

  const cacheReadRate = rates.cacheReadPerMillion ?? 0
  const cacheWriteRate = rates.cacheWritePerMillion ?? 0

  let cost =
    (uncached * rates.inputPerMillion) / 1_000_000 +
    (cacheReadTokens * cacheReadRate) / 1_000_000 +
    (cacheWriteTokens * cacheWriteRate) / 1_000_000 +
    (outputTokens * rates.outputPerMillion) / 1_000_000

  const reasoningRate = rates.reasoningPerMillion
  const reasoningOutsideOutput =
    reasoningRate !== undefined &&
    reasoningTokens > 0 &&
    usage.textTokens !== undefined &&
    usage.outputTokens !== undefined &&
    usage.outputTokens === usage.textTokens

  if (reasoningOutsideOutput) {
    cost += (reasoningTokens * reasoningRate) / 1_000_000
  }

  return cost
}
