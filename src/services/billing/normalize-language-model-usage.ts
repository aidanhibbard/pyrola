import type { LanguageModelUsage } from 'ai'
import type { BillableUsageRecord } from '@/types/billing/billable-usage-record'

type NormalizedUsage = BillableUsageRecord['usage'] & { usageMissing: boolean }

const isAbsentOrZero = (value: number | undefined): boolean =>
  value === undefined || value === 0

/**
 * Flatten AI SDK LanguageModelUsage into the billable usage snapshot.
 * Copies fields verbatim. Never invents or re-tokenizes.
 */
export default (usage: LanguageModelUsage | undefined): NormalizedUsage => {
  if (!usage) {
    return { usageMissing: true }
  }

  const inputTokens = usage.inputTokens
  const noCacheTokens = usage.inputTokenDetails.noCacheTokens
  const cacheReadTokens = usage.inputTokenDetails.cacheReadTokens
  const cacheWriteTokens = usage.inputTokenDetails.cacheWriteTokens
  const outputTokens = usage.outputTokens
  const textTokens = usage.outputTokenDetails.textTokens
  const reasoningTokens = usage.outputTokenDetails.reasoningTokens
  const totalTokens = usage.totalTokens
  const raw = usage.raw

  const usageMissing =
    isAbsentOrZero(inputTokens) &&
    isAbsentOrZero(noCacheTokens) &&
    isAbsentOrZero(cacheReadTokens) &&
    isAbsentOrZero(cacheWriteTokens) &&
    isAbsentOrZero(outputTokens) &&
    isAbsentOrZero(textTokens) &&
    isAbsentOrZero(reasoningTokens) &&
    isAbsentOrZero(totalTokens)

  const normalized: NormalizedUsage = { usageMissing }

  if (inputTokens !== undefined) {
    normalized.inputTokens = inputTokens
  }
  if (noCacheTokens !== undefined) {
    normalized.noCacheTokens = noCacheTokens
  }
  if (cacheReadTokens !== undefined) {
    normalized.cacheReadTokens = cacheReadTokens
  }
  if (cacheWriteTokens !== undefined) {
    normalized.cacheWriteTokens = cacheWriteTokens
  }
  if (outputTokens !== undefined) {
    normalized.outputTokens = outputTokens
  }
  if (reasoningTokens !== undefined) {
    normalized.reasoningTokens = reasoningTokens
  }
  if (textTokens !== undefined) {
    normalized.textTokens = textTokens
  }
  if (totalTokens !== undefined) {
    normalized.totalTokens = totalTokens
  }
  if (raw !== undefined) {
    normalized.raw = raw
  }

  return normalized
}
