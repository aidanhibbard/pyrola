import { describe, expect, it } from 'vitest'
import estimateBuiltinToolDefinitionTokens from '@/services/context/estimate-builtin-tool-definition-tokens'

describe('estimateBuiltinToolDefinitionTokens', () => {
  it('returns a positive token estimate for agent mode tools', () => {
    const tokens = estimateBuiltinToolDefinitionTokens('agent')
    expect(tokens).toBeGreaterThan(1000)
  })

  it('estimates fewer tokens for ask mode than agent mode', () => {
    const ask = estimateBuiltinToolDefinitionTokens('ask')
    const agent = estimateBuiltinToolDefinitionTokens('agent')
    expect(ask).toBeLessThan(agent)
  })
})
