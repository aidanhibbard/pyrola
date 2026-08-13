import { describe, expect, it } from 'vitest'
import aggregateTurnUsage from '@/services/billing/aggregate-turn-usage'
import type { BillableUsageRecord } from '@/types/billing/billable-usage-record'

const baseRecord = (
  patch: Partial<BillableUsageRecord> &
    Pick<BillableUsageRecord, 'id' | 'source' | 'costUSD' | 'pricingSource'>,
): BillableUsageRecord => ({
  chatId: 'chat-1',
  turnId: 'turn-1',
  at: '2026-01-01T00:00:00.000Z',
  providerId: 'openai',
  modelId: 'gpt-4o',
  usage: {
    inputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 10,
    cacheWriteTokens: 5,
  },
  ...patch,
})

describe('aggregateTurnUsage', () => {
  it('sums main + subagent records for the same turnId', () => {
    const records: BillableUsageRecord[] = [
      baseRecord({
        id: 'a',
        source: 'main',
        costUSD: 0.01,
        pricingSource: 'user_configured',
      }),
      baseRecord({
        id: 'b',
        source: 'subagent',
        subagentId: 'sub-1',
        costUSD: 0.02,
        pricingSource: 'user_configured',
        usage: {
          inputTokens: 200,
          outputTokens: 25,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      }),
      baseRecord({
        id: 'c',
        source: 'main',
        turnId: 'other-turn',
        costUSD: 9,
        pricingSource: 'user_configured',
      }),
    ]

    const aggregate = aggregateTurnUsage(records, 'turn-1')
    expect(aggregate.inputTokens).toBe(300)
    expect(aggregate.outputTokens).toBe(75)
    expect(aggregate.cacheReadTokens).toBe(10)
    expect(aggregate.cacheWriteTokens).toBe(5)
    expect(aggregate.costUSD).toBeCloseTo(0.03)
    expect(aggregate.pricingComplete).toBe(true)
    expect(aggregate.usageMissing).toBe(false)
    expect(aggregate.parts).toHaveLength(2)
  })

  it('sums known costs when a token record is unpriced', () => {
    const records: BillableUsageRecord[] = [
      baseRecord({
        id: 'a',
        source: 'main',
        costUSD: 0.0072,
        pricingSource: 'provider_reported',
      }),
      baseRecord({
        id: 'b',
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
    ]

    const aggregate = aggregateTurnUsage(records, 'turn-1')
    expect(aggregate.costUSD).toBeCloseTo(0.0072)
    expect(aggregate.pricingComplete).toBe(false)
  })

  it('returns null cost when no record is priced', () => {
    const records: BillableUsageRecord[] = [
      baseRecord({
        id: 'a',
        source: 'main',
        costUSD: null,
        pricingSource: 'none',
      }),
    ]

    const aggregate = aggregateTurnUsage(records, 'turn-1')
    expect(aggregate.costUSD).toBeNull()
    expect(aggregate.pricingComplete).toBe(false)
  })

  it('propagates usageMissing from any part', () => {
    const records: BillableUsageRecord[] = [
      baseRecord({
        id: 'a',
        source: 'main',
        costUSD: null,
        pricingSource: 'none',
        usageMissing: true,
        usage: {},
      }),
      baseRecord({
        id: 'b',
        source: 'subagent',
        subagentId: 'sub-1',
        costUSD: 0.01,
        pricingSource: 'user_configured',
      }),
    ]

    const aggregate = aggregateTurnUsage(records, 'turn-1')
    expect(aggregate.usageMissing).toBe(true)
    // Record a has no tokens, so pricingComplete only considers record b.
    expect(aggregate.pricingComplete).toBe(true)
    expect(aggregate.costUSD).toBeCloseTo(0.01)
  })
})
