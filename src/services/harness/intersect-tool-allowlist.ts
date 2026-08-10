/** Intersect an optional agent tool list with a base allowlist. Absent tools keeps the base list. */
export default (
  baseAllowlist: readonly string[],
  agentTools?: readonly string[],
): string[] => {
  if (!agentTools) {
    return [...baseAllowlist]
  }
  const allow = new Set(baseAllowlist)
  return agentTools.filter((tool) => allow.has(tool))
}
