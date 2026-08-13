import { describe, expect, it } from 'vitest'
import isGatewayGenerationPending from '@/services/billing/is-gateway-generation-pending'

describe('isGatewayGenerationPending', () => {
  it('treats Invalid error response format message as pending', () => {
    expect(
      isGatewayGenerationPending(
        new Error('Invalid error response format: Gateway request failed'),
      ),
    ).toBe(true)
  })

  it('treats Usage event not found response body as pending', () => {
    const error = Object.assign(new Error('Gateway request failed'), {
      name: 'GatewayResponseError',
      response: { error: 'Usage event not found' },
    })
    expect(isGatewayGenerationPending(error)).toBe(true)
  })

  it('treats No usage event found message as pending', () => {
    expect(
      isGatewayGenerationPending(
        new Error('No usage event found for generation gen_123'),
      ),
    ).toBe(true)
  })

  it('returns false for unrelated hard failures', () => {
    expect(isGatewayGenerationPending(new Error('Unauthorized'))).toBe(false)
    expect(isGatewayGenerationPending(new Error('rate_limit_exceeded'))).toBe(
      false,
    )
    expect(isGatewayGenerationPending('not-an-error')).toBe(false)
  })
})
