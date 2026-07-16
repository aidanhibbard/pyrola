import { ref } from 'vue'
import { toast } from 'vue-sonner'
import type { McpConfig, McpServerConfig } from '@/types/pyrola/mcp-config'
import { migrateMcpConfig } from '@/schemas/mcp-config'
import { listEffectiveMcpServers, listScopedMcpServers } from '@/services/mcp/merge-mcp-config'
import {
  mcpLogout,
  mcpRefresh,
  mcpStart,
  mcpStatus,
  mcpStop,
  readMcpConfig,
  writeMcpConfig,
  type McpServerState,
} from '@/services/pyrola/pyrola-tauri'
import type { SettingsTab } from '@/composables/use-pyrola-config'

const isStdioServer = (
  config: McpServerConfig,
): config is { command: string; args?: string[] } => 'command' in config

const personalMcp = ref<McpConfig>({ servers: {} })
const projectMcp = ref<McpConfig>({ servers: {} })
const serverStates = ref<Record<string, McpServerState>>({})
const loadingServers = ref<Record<string, boolean>>({})

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

  const refreshStates = async (): Promise<void> => {
    const effective = listEffectiveMcpServers(personalMcp.value, projectMcp.value)
    const previousIds = new Set(Object.keys(serverStates.value))
    const nextStates: Record<string, McpServerState> = {}

    for (const server of effective) {
      previousIds.delete(server.id)
      try {
        nextStates[server.id] = await mcpStatus(server.id)
      } catch {
        nextStates[server.id] = {
          serverId: server.id,
          status: 'stopped',
          tools: [],
        }
      }
    }

    for (const removedId of previousIds) {
      await mcpStop(removedId)
    }

    serverStates.value = nextStates
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
        serverStates.value[serverId] = state
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
        serverStates.value[serverId] = {
          serverId,
          status: 'stopped',
          tools: [],
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
        serverStates.value[serverId] = state
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
      serverStates.value[serverId] = {
        serverId,
        status: 'auth_required',
        tools: [],
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
