import { ref } from 'vue'
import { toast } from 'vue-sonner'
import type { McpConfig, McpServerConfig } from '@/types/pyrola/mcp-config'
import { migrateMcpConfig } from '@/schemas/mcp-config'
import { listEffectiveMcpServers, listScopedMcpServers } from '@/services/mcp/merge-mcp-config'
import {
  mcpListStatuses,
  mcpLogout,
  mcpRefresh,
  mcpStart,
  mcpStop,
  readMcpConfig,
  writeMcpConfig,
  type McpServerState,
} from '@/services/pyrola/pyrola-tauri'
import type { SettingsTab } from '@/composables/use-pyrola-config'

const isStdioServer = (
  config: McpServerConfig,
): config is { command: string; args?: string[] } => 'command' in config

const isActiveStatus = (status: string): boolean =>
  status === 'connected' || status === 'starting' || status === 'refreshing'

const personalMcp = ref<McpConfig>({ servers: {} })
const projectMcp = ref<McpConfig>({ servers: {} })
const serverStates = ref<Record<string, McpServerState>>({})
const loadingServers = ref<Record<string, boolean>>({})
let refreshGeneration = 0

export default () => {
  const setServerLoading = (serverId: string, loading: boolean): void => {
    loadingServers.value = {
      ...loadingServers.value,
      [serverId]: loading,
    }
  }

  const withServerLoading = async (
    serverId: string,
    action: () => Promise<void>,
  ): Promise<void> => {
    setServerLoading(serverId, true)
    try {
      await action()
    } finally {
      setServerLoading(serverId, false)
    }
  }
  const loadConfigs = async (rootPath: string | null): Promise<void> => {
    const personalRaw = await readMcpConfig('personal')
    personalMcp.value = migrateMcpConfig(personalRaw)

    if (rootPath) {
      const projectRaw = await readMcpConfig('project', rootPath)
      projectMcp.value = migrateMcpConfig(projectRaw)
    } else {
      projectMcp.value = { servers: {} }
    }
  }

  const mergeServerState = (
    serverId: string,
    freshState: McpServerState | undefined,
    existing: McpServerState | undefined,
  ): McpServerState => {
    if (freshState) {
      return freshState
    }

    const existingStatus = existing?.status ?? 'stopped'
    if (isActiveStatus(existingStatus)) {
      return existing ?? {
        serverId,
        status: existingStatus,
        tools: [],
      }
    }

    return {
      serverId,
      status: 'stopped',
      tools: [],
    }
  }

  const refreshStates = async (): Promise<void> => {
    const generation = ++refreshGeneration
    const effective = listEffectiveMcpServers(personalMcp.value, projectMcp.value)
    const previousIds = new Set(Object.keys(serverStates.value))

    let bulkStatuses: Record<string, McpServerState> = {}
    try {
      bulkStatuses = await mcpListStatuses()
    } catch (error) {
      if (generation !== refreshGeneration) {
        return
      }
      toast.error('Failed to refresh MCP server status', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
      return
    }

    if (generation !== refreshGeneration) {
      return
    }

    const merged: Record<string, McpServerState> = { ...serverStates.value }

    for (const server of effective) {
      previousIds.delete(server.id)
      merged[server.id] = mergeServerState(
        server.id,
        bulkStatuses[server.id],
        serverStates.value[server.id],
      )
    }

    if (generation !== refreshGeneration) {
      return
    }

    for (const removedId of previousIds) {
      try {
        await mcpStop(removedId)
      } catch {
        // Best-effort cleanup for servers removed from config.
      }
      if (generation !== refreshGeneration) {
        return
      }
      delete merged[removedId]
    }

    if (generation !== refreshGeneration) {
      return
    }

    serverStates.value = merged
  }

  const saveScopedConfig = async (
    tab: SettingsTab,
    config: McpConfig,
    rootPath: string | null,
  ): Promise<void> => {
    const scope = tab === 'personal' ? 'personal' : 'project'
    await writeMcpConfig(scope, config, rootPath)
    if (scope === 'personal') {
      personalMcp.value = config
    } else {
      projectMcp.value = config
    }
  }

  const startServer = async (
    serverId: string,
    config: McpServerConfig,
    options?: { quiet?: boolean },
  ): Promise<void> => {
    if (!isStdioServer(config)) {
      toast.error('Only stdio MCP servers are supported in this build')
      return
    }

    await withServerLoading(serverId, async () => {
      try {
        const state = await mcpStart(serverId, config.command, config.args ?? [])
        serverStates.value = {
          ...serverStates.value,
          [serverId]: state,
        }
        if (!options?.quiet) {
          toast.success(`${serverId} connected — ${state.tools.length} tools`)
        }
      } catch (error) {
        toast.error('Failed to start server', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  }

  const stopServer = async (
    serverId: string,
    options?: { quiet?: boolean },
  ): Promise<void> => {
    await withServerLoading(serverId, async () => {
      try {
        await mcpStop(serverId)
        serverStates.value = {
          ...serverStates.value,
          [serverId]: {
            serverId,
            status: 'stopped',
            tools: [],
          },
        }
        if (!options?.quiet) {
          toast.success(`${serverId} stopped`)
        }
      } catch (error) {
        toast.error('Failed to stop server', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  }

  const refreshServer = async (
    serverId: string,
    options?: { quiet?: boolean },
  ): Promise<void> => {
    await withServerLoading(serverId, async () => {
      try {
        const state = await mcpRefresh(serverId)
        serverStates.value = {
          ...serverStates.value,
          [serverId]: state,
        }
        if (!options?.quiet) {
          toast.success(`${serverId} refreshed — ${state.tools.length} tools`)
        }
      } catch (error) {
        toast.error('Refresh failed', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  }

  const refreshOrStartServer = async (
    serverId: string,
    config: McpServerConfig,
    options?: { quiet?: boolean },
  ): Promise<void> => {
    const status = serverStates.value[serverId]?.status ?? 'stopped'
    if (status === 'connected' || status === 'error' || status === 'refreshing') {
      await refreshServer(serverId, options)
      return
    }
    await startServer(serverId, config, options)
  }

  const refreshAllServers = async (
    servers: Array<{ id: string; config: McpServerConfig }>,
  ): Promise<void> => {
    for (const server of servers) {
      await refreshOrStartServer(server.id, server.config, { quiet: true })
    }
    toast.success('All servers refreshed')
  }

  const logoutServer = async (serverId: string): Promise<void> => {
    try {
      await mcpLogout(serverId)
      serverStates.value = {
        ...serverStates.value,
        [serverId]: {
          serverId,
          status: 'auth_required',
          tools: [],
        },
      }
    } catch (error) {
      toast.error('Failed to log out', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const addServer = async (
    tab: SettingsTab,
    serverId: string,
    config: McpServerConfig,
    rootPath: string | null,
  ): Promise<void> => {
    const scoped = tab === 'personal' ? personalMcp.value : projectMcp.value
    const next = {
      servers: {
        ...scoped.servers,
        [serverId]: config,
      },
    }
    await saveScopedConfig(tab, next, rootPath)
    await refreshStates()
  }

  const deleteServer = async (
    tab: SettingsTab,
    serverId: string,
    rootPath: string | null,
  ): Promise<void> => {
    const scoped = tab === 'personal' ? personalMcp.value : projectMcp.value
    const { [serverId]: _removed, ...rest } = scoped.servers
    await saveScopedConfig(tab, { servers: rest }, rootPath)
    await mcpStop(serverId)
    await refreshStates()
  }

  return {
    personalMcp,
    projectMcp,
    serverStates,
    loadingServers,
    loadConfigs,
    refreshStates,
    startServer,
    stopServer,
    refreshServer,
    refreshOrStartServer,
    refreshAllServers,
    logoutServer,
    addServer,
    deleteServer,
    listEffectiveMcpServers,
    listScopedMcpServers,
  }
}
