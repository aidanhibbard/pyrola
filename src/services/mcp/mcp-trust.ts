import type { McpTrustRecord, McpTrustScope } from '@/types/harness/permission'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'

export const sessionTrusts = new Set<string>()

export const getMcpTrust = (
  settings: PyrolaSettings,
  serverId: string,
): McpTrustRecord | undefined =>
  (settings['agent.mcp.trust'] ?? []).find((record) => record.serverId === serverId)

export const isMcpTrusted = (
  settings: PyrolaSettings,
  serverId: string,
  trustedInSession: Set<string> = sessionTrusts,
): boolean => {
  if (trustedInSession.has(serverId)) {
    return true
  }
  const record = getMcpTrust(settings, serverId)
  return record?.scope === 'always' || record?.scope === 'workspace'
}

export const upsertMcpTrustRecord = (
  records: McpTrustRecord[],
  serverId: string,
  scope: McpTrustScope,
): McpTrustRecord[] => {
  const existing = records.findIndex((r) => r.serverId === serverId)
  if (existing >= 0) {
    return records.map((r, i) => (i === existing ? { serverId, scope } : r))
  }
  return [...records, { serverId, scope }]
}
