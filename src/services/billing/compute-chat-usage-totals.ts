import type { BillableUsageRecord } from '@/types/billing/billable-usage-record'
import type { ChatUsageTotals } from '@/types/chat/chat-meta'

const recordHasTokens = (record: BillableUsageRecord): boolean => {
  const usage = record.usage
  return (
    (usage.inputTokens ?? 0) > 0 ||
    (usage.outputTokens ?? 0) > 0 ||
    (usage.cacheReadTokens ?? 0) > 0 ||
    (usage.cacheWriteTokens ?? 0) > 0 ||
    (usage.noCacheTokens ?? 0) > 0 ||
    (usage.reasoningTokens ?? 0) > 0 ||
    (usage.textTokens ?? 0) > 0 ||
    (usage.totalTokens ?? 0) > 0
  )
}

/**
 * Chat-level rollup from the full usage ledger (source of truth for tokens/$).
 */
export default (records: BillableUsageRecord[]): ChatUsageTotals => {
  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens = 0
  let cacheWriteTokens = 0
  let costSum = 0
  let allCostsPresent = true

  for (const record of records) {
    inputTokens += record.usage.inputTokens ?? 0
    outputTokens += record.usage.outputTokens ?? 0
    cacheReadTokens += record.usage.cacheReadTokens ?? 0
    cacheWriteTokens += record.usage.cacheWriteTokens ?? 0

    if (record.costUSD === null) {
      allCostsPresent = false
    } else {
      costSum += record.costUSD
    }
  }

  const tokenRecords = records.filter(recordHasTokens)
  const pricingComplete = tokenRecords.every(
    (record) => record.costUSD !== null,
  )

  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    // Never invent $0: null when empty or when any record lacks cost.
    costUSD: records.length > 0 && allCostsPresent ? costSum : null,
    pricingComplete,
  }
}
