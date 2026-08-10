import { describe, expect, it } from 'vitest'
import {
  modelShortId,
  modelVendorId,
  modelVendorLabel,
  stripModelAliasMarker,
} from '@/utils/model-vendor'

describe('model-vendor', () => {
  it('strips openrouter latest alias marker for grouping', () => {
    expect(stripModelAliasMarker('~anthropic/claude-sonnet-latest')).toBe(
      'anthropic/claude-sonnet-latest',
    )
    expect(modelVendorId('~anthropic/claude-sonnet-latest')).toBe('anthropic')
    expect(modelVendorId('anthropic/claude-sonnet-4')).toBe('anthropic')
    expect(modelVendorLabel('~anthropic/claude-sonnet-latest')).toBe('Anthropic')
    expect(modelShortId('~anthropic/claude-sonnet-latest')).toBe(
      'claude-sonnet-latest',
    )
  })
})
