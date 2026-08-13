import { describe, expect, it } from 'vitest'
import extractGatewayMetadataCost from '@/services/billing/extract-gateway-metadata-cost'

describe('extractGatewayMetadataCost', () => {
  it('parses string cost from community gateway metadata shape', () => {
    expect(
      extractGatewayMetadataCost({
        gateway: {
          cost: '0.00849',
          marketCost: '0.00849',
          surchargeCost: '0',
          gatewayCost: '0.00849',
          inferenceCost: '0.00849',
          inputInferenceCost: '0.00744',
          outputInferenceCost: '0.00105',
          generationId: 'gen_01KT4C7A322AA7XN4JV02506VR',
        },
      }),
    ).toBe(0.00849)
  })

  it('parses numeric cost and gatewayCost fields', () => {
    expect(
      extractGatewayMetadataCost({
        gateway: { cost: 0.012 },
      }),
    ).toBe(0.012)
    expect(
      extractGatewayMetadataCost({
        gateway: { gatewayCost: 0.034 },
      }),
    ).toBe(0.034)
  })

  it('prefers marketCost for explicit BYOK', () => {
    expect(
      extractGatewayMetadataCost({
        gateway: {
          isByok: true,
          cost: '0.0001',
          marketCost: '0.00849',
          gatewayCost: '0.0001',
        },
      }),
    ).toBe(0.00849)
  })

  it('prefers marketCost when total is below non-zero market (BYOK split)', () => {
    expect(
      extractGatewayMetadataCost({
        gateway: {
          cost: '0',
          gatewayCost: '0',
          marketCost: '0.00849',
          inferenceCost: '0.00849',
        },
      }),
    ).toBe(0.00849)
  })

  it('uses total cost when market equals total (non-BYOK)', () => {
    expect(
      extractGatewayMetadataCost({
        gateway: {
          cost: '0.01',
          marketCost: '0.01',
          gatewayCost: '0.01',
        },
      }),
    ).toBe(0.01)
  })

  it('uses total cost when surcharge makes total above market (non-BYOK)', () => {
    expect(
      extractGatewayMetadataCost({
        gateway: {
          cost: '0.011',
          marketCost: '0.01',
          surchargeCost: '0.001',
          gatewayCost: '0.011',
        },
      }),
    ).toBe(0.011)
  })

  it('returns null when gateway cost fields are missing', () => {
    expect(
      extractGatewayMetadataCost({
        gateway: { generationId: 'gen_abc' },
      }),
    ).toBeNull()
  })

  it('returns null for absent or non-object providerMetadata', () => {
    expect(extractGatewayMetadataCost(undefined)).toBeNull()
    expect(extractGatewayMetadataCost(null)).toBeNull()
    expect(extractGatewayMetadataCost('x')).toBeNull()
    expect(extractGatewayMetadataCost({})).toBeNull()
  })

  it('returns null for non-finite cost strings', () => {
    expect(
      extractGatewayMetadataCost({
        gateway: { cost: 'not-a-number' },
      }),
    ).toBeNull()
    expect(
      extractGatewayMetadataCost({
        gateway: { cost: '' },
      }),
    ).toBeNull()
  })
})
