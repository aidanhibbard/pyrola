/**
 * Read OpenRouter-style provider cost from raw usage.
 * Never invents a cost: absent or non-finite cost => null.
 */
export default (
  raw: unknown,
): { costUSD: number | null; costDetails?: unknown } => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { costUSD: null }
  }

  const record = raw as Record<string, unknown>
  const cost = record.cost
  const costUSD =
    typeof cost === 'number' && Number.isFinite(cost) ? cost : null

  if (!('cost_details' in record)) {
    return { costUSD }
  }

  return {
    costUSD,
    costDetails: record.cost_details,
  }
}
