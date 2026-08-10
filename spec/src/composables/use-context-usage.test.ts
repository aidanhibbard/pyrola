import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextBudget } from '@/types/harness/context-budget'

const sampleBudget = (promptUsed: number): ContextBudget => ({
  modelId: 'test-model',
  limit: 262_000,
  promptUsed,
  reservedOutput: 33_000,
  safetyBuffer: 2_000,
  free: Math.max(0, 262_000 - 33_000 - 2_000 - promptUsed),
  used: promptUsed,
  buckets: [
    {
      id: 'messages',
      label: 'Conversation',
      tokens: promptUsed,
    },
  ],
})

describe('useContextUsage', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('keeps ring fill on the budget estimate after last-step usage', async () => {
    const { default: useContextUsage } = await import(
      '@/composables/use-context-usage'
    )
    const contextUsage = useContextUsage()

    contextUsage.setBudget(sampleBudget(167_000))
    expect(contextUsage.promptUsed.value).toBe(167_000)
    expect(contextUsage.free.value).toBe(60_000)
    expect(contextUsage.ratio.value).toBeCloseTo(167_000 / 227_000)

    contextUsage.setLastStepUsage({
      promptTokens: 20_000,
      inputTokens: 20_000,
      outputTokens: 37,
      cacheReadTokens: 20_000,
      cacheWriteTokens: 0,
    })

    // Last-step input is lower than the estimate: keep the estimate (no snap-down).
    expect(contextUsage.promptUsed.value).toBe(167_000)
    expect(contextUsage.free.value).toBe(60_000)
    expect(contextUsage.ratio.value).toBeCloseTo(167_000 / 227_000)
    expect(contextUsage.lastStepUsage.value?.inputTokens).toBe(20_000)
    expect(contextUsage.hasLastStepUsage.value).toBe(true)
  })

  it('floors ring fill to last-step input when the estimate undercounts', async () => {
    const { default: useContextUsage } = await import(
      '@/composables/use-context-usage'
    )
    const contextUsage = useContextUsage()

    contextUsage.setBudget(sampleBudget(5_000))
    contextUsage.setLastStepUsage({
      promptTokens: 51_000,
      inputTokens: 51_000,
      outputTokens: 1_200,
      cacheReadTokens: 47_000,
      cacheWriteTokens: 0,
    })

    expect(contextUsage.promptUsed.value).toBe(51_000)
    expect(contextUsage.free.value).toBe(227_000 - 51_000)
  })

  it('clears last-step footer state when setBudget clears provider fill', async () => {
    const { default: useContextUsage } = await import(
      '@/composables/use-context-usage'
    )
    const contextUsage = useContextUsage()

    contextUsage.setBudget(sampleBudget(167_000))
    contextUsage.setLastStepUsage({
      promptTokens: 20_000,
      inputTokens: 20_000,
      outputTokens: 37,
      cacheReadTokens: 20_000,
      cacheWriteTokens: 0,
    })

    contextUsage.setBudget(sampleBudget(170_000), { clearProviderFill: true })

    expect(contextUsage.promptUsed.value).toBe(170_000)
    expect(contextUsage.lastStepUsage.value).toBeNull()
    expect(contextUsage.hasLastStepUsage.value).toBe(false)
  })
})
