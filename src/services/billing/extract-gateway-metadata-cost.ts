/**
 * Read AI Gateway cost from providerMetadata.gateway.
 * Never invents a cost: absent or non-finite => null.
 *
 * Maps analogously to enrich-gateway-cost:
 * Non-BYOK billed amount is total cost (includes surcharges).
 * BYOK: prefer market / upstream inference cost.
 */

const parseCostField = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

const firstFiniteCost = (
  record: Record<string, unknown>,
  keys: readonly string[],
): number | null => {
  for (const key of keys) {
    const parsed = parseCostField(record[key])
    if (parsed !== null) {
      return parsed
    }
  }
  return null
}

const readGatewayRecord = (
  providerMetadata: unknown,
): Record<string, unknown> | null => {
  if (
    !providerMetadata ||
    typeof providerMetadata !== 'object' ||
    Array.isArray(providerMetadata)
  ) {
    return null
  }
  const gateway = (providerMetadata as Record<string, unknown>).gateway
  if (!gateway || typeof gateway !== 'object' || Array.isArray(gateway)) {
    return null
  }
  return gateway as Record<string, unknown>
}

/**
 * Detect BYOK when metadata is reliable:
 * explicit isByok, or non-zero market vs total split (total < market),
 * matching enrich: BYOK total excludes provider inference.
 */
const detectByok = (
  gateway: Record<string, unknown>,
  totalCost: number | null,
  marketCost: number | null,
): boolean => {
  if (gateway.isByok === true) {
    return true
  }
  return (
    marketCost !== null &&
    marketCost > 0 &&
    totalCost !== null &&
    totalCost < marketCost
  )
}

export default (providerMetadata: unknown): number | null => {
  const gateway = readGatewayRecord(providerMetadata)
  if (!gateway) {
    return null
  }

  const totalCost = firstFiniteCost(gateway, ['cost', 'gatewayCost'])
  const marketCost = firstFiniteCost(gateway, [
    'marketCost',
    'inferenceCost',
    'upstreamInferenceCost',
  ])

  if (detectByok(gateway, totalCost, marketCost)) {
    return marketCost
  }

  return totalCost
}
