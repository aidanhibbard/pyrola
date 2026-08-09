import type { BillableUsageRecord } from '@/types/billing/billable-usage-record'
import type { TurnUsageAggregate } from '@/types/billing/turn-usage-aggregate'

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
 * Aggregate billable records for a single agent turn.
 */
export default (
  records: BillableUsageRecord[],
  turnId: string,
): TurnUsageAggregate => {
  const parts = records.filter((record) => record.turnId === turnId)

  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens = 0
  let cacheWriteTokens = 0
  let costSum = 0
  let allCostsPresent = true
  let usageMissing = false

  for (const record of parts) {
    inputTokens += record.usage.inputTokens ?? 0
    outputTokens += record.usage.outputTokens ?? 0
    cacheReadTokens += record.usage.cacheReadTokens ?? 0
    cacheWriteTokens += record.usage.cacheWriteTokens ?? 0

    if (record.usageMissing) {
      usageMissing = true
    }

    if (record.costUSD === null) {
      allCostsPresent = false
    } else {
      costSum += record.costUSD
    }
  }

  const tokenParts = parts.filter(recordHasTokens)
  const tokenCostsComplete = tokenParts.every(
    (record) => record.costUSD !== null,
  )

  // costUSD null when any record lacks cost, or when a tokens>0 record lacks cost.
  const costUSD =
    parts.length > 0 && allCostsPresent && tokenCostsComplete ? costSum : null

  return {
    turnId,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    costUSD,
    pricingComplete: tokenCostsComplete,
    usageMissing,
    parts,
  }
}
