import { describe, expect, it } from 'vitest'
import serializeModelRef from '@/utils/serialize-model-ref'

describe('serializeModelRef', () => {
  it('serializes provider and model id', () => {
    expect(
      serializeModelRef({ providerId: 'anthropic', modelId: 'claude-sonnet-4-5' }),
    ).toBe('anthropic::claude-sonnet-4-5')
  })
})
