import type { McpConfig, McpServerConfig, McpServerScope } from '@/types/pyrola/mcp-config'
import { defaultMcpConfig } from '@/schemas/mcp-config'

export type EffectiveMcpServer = {
  id: string
  config: McpServerConfig
  scope: McpServerScope
}

export const mergeMcpConfig = (
  personal: McpConfig,
  project: McpConfig | null,
): McpConfig => {
  if (!project) {
    return { servers: { ...personal.servers } }
  }

  return {
    servers: {
      ...personal.servers,
      ...project.servers,
    },
  }
}

export const listEffectiveMcpServers = (
  personal: McpConfig,
  project: McpConfig | null,
): EffectiveMcpServer[] => {
  const personalIds = new Set(Object.keys(personal.servers))
  const projectIds = new Set(Object.keys(project?.servers ?? {}))
  const allIds = new Set([...personalIds, ...projectIds])

  const servers: EffectiveMcpServer[] = []

  for (const id of allIds) {
    const inPersonal = personalIds.has(id)
    const inProject = projectIds.has(id)

    if (inProject) {
      servers.push({
        id,
        config: project!.servers[id]!,
        scope: inPersonal ? 'overridden' : 'project',
      })
      continue
    }

    servers.push({
      id,
      config: personal.servers[id]!,
      scope: 'personal',
    })
  }

  return servers.sort((a, b) => a.id.localeCompare(b.id))
}

export const listScopedMcpServers = (
  personal: McpConfig,
  project: McpConfig | null,
  tab: 'personal' | 'project',
): EffectiveMcpServer[] => {
  const personalIds = new Set(Object.keys(personal.servers))

  if (tab === 'personal') {
    return Object.entries(personal.servers)
      .map(([id, config]) => ({
        id,
        config,
        scope: 'personal' as const,
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  return Object.entries(project?.servers ?? {})
    .map(([id, config]) => ({
      id,
      config,
      scope: (personalIds.has(id) ? 'overridden' : 'project') as McpServerScope,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export const emptyMcpConfig = (): McpConfig => defaultMcpConfig()
