import { describe, expect, it } from 'vitest'
import computeChatUsageTotals from '@/services/billing/compute-chat-usage-totals'
import type { BillableUsageRecord } from '@/types/billing/billable-usage-record'

const baseRecord = (
  patch: Partial<BillableUsageRecord> &
    Pick<BillableUsageRecord, 'id' | 'source' | 'costUSD' | 'pricingSource'>,
): BillableUsageRecord => ({
  chatId: 'chat-1',
  turnId: 'turn-1',
  at: '2026-01-01T00:00:00.000Z',
  providerId: 'gateway',
  modelId: 'openai/gpt-4o',
  usage: {
    inputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
  ...patch,
})

describe('computeChatUsageTotals', () => {
  it('sums known costs when title naming is unpriced', () => {
    const totals = computeChatUsageTotals([
      baseRecord({
        id: 'main',
        source: 'main',
        costUSD: 0.0072,
        pricingSource: 'provider_reported',
      }),
      baseRecord({
        id: 'title',
        source: 'title',
        providerId: 'ollama',
        modelId: 'local',
        costUSD: null,
        pricingSource: 'none',
        usage: {
          inputTokens: 126,
          outputTokens: 4,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      }),
    ])

    expect(totals.costUSD).toBeCloseTo(0.0072)
    expect(totals.pricingComplete).toBe(false)
    expect(totals.inputTokens).toBe(226)
    expect(totals.outputTokens).toBe(54)
  })

  it('returns null cost when nothing is priced', () => {
    const totals = computeChatUsageTotals([
      baseRecord({
        id: 'main',
        source: 'main',
        costUSD: null,
        pricingSource: 'none',
      }),
    ])

    expect(totals.costUSD).toBeNull()
    expect(totals.pricingComplete).toBe(false)
  })

  it('returns null cost for an empty ledger', () => {
    const totals = computeChatUsageTotals([])
    expect(totals.costUSD).toBeNull()
    expect(totals.pricingComplete).toBe(true)
  })
})
