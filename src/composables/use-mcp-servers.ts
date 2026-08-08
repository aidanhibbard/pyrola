import { ref } from 'vue'
import { toast } from 'vue-sonner'
import type { McpConfig, McpServerConfig } from '@/types/pyrola/mcp-config'
import { migrateMcpConfig } from '@/schemas/mcp-config'
import { listEffectiveMcpServers, listScopedMcpServers } from '@/services/mcp/merge-mcp-config'
import mcpRuntime from '@/services/mcp/mcp-runtime'
import {
  readMcpConfig,
  writeMcpConfig,
  type McpServerState,
} from '@/services/pyrola/pyrola-tauri'
import type { SettingsTab } from '@/composables/use-pyrola-config'

const isActiveStatus = (status: string): boolean =>
  status === 'connected' || status === 'starting' || status === 'refreshing'

const personalMcp = ref<McpConfig>({ servers: {} })
const projectMcp = ref<McpConfig>({ servers: {} })
const serverStates = ref<Record<string, McpServerState>>({})
const loadingServers = ref<Record<string, boolean>>({})
const authenticatingServers = ref<Record<string, boolean>>({})
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
      bulkStatuses = await mcpRuntime.listStatuses()
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
        await mcpRuntime.stop(removedId)
      } catch (error) {
        toast.error('Failed to stop MCP server', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
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
    options?: { quiet?: boolean; manageLoading?: boolean },
  ): Promise<void> => {
    const run = async (): Promise<void> => {
      try {
        const state = await mcpRuntime.start(serverId, config)
        serverStates.value = {
          ...serverStates.value,
          [serverId]: state,
        }
        if (!options?.quiet) {
          toast.success(`${serverId} connected (${state.tools.length} tools)`)
        }
      } catch (error) {
        serverStates.value = {
          ...serverStates.value,
          [serverId]: {
            serverId,
            status: 'error',
            tools: [],
            error: error instanceof Error ? error.message : String(error),
          },
        }
        toast.error('Failed to start server', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    if (options?.manageLoading === false) {
      await run()
      return
    }
    await withServerLoading(serverId, run)
  }

  const refreshServer = async (
    serverId: string,
    config?: McpServerConfig,
    options?: { quiet?: boolean },
  ): Promise<void> => {
    await withServerLoading(serverId, async () => {
      try {
        const resolvedConfig =
          config ??
          listEffectiveMcpServers(personalMcp.value, projectMcp.value).find(
            (server) => server.id === serverId,
          )?.config
        const state = await mcpRuntime.refresh(serverId, resolvedConfig)
        serverStates.value = {
          ...serverStates.value,
          [serverId]: state,
        }
        if (!options?.quiet) {
          toast.success(`${serverId} refreshed (${state.tools.length} tools)`)
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
      await refreshServer(serverId, config, options)
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

  const authenticateServer = async (
    serverId: string,
    config: McpServerConfig,
  ): Promise<void> => {
    authenticatingServers.value = {
      ...authenticatingServers.value,
      [serverId]: true,
    }
    await withServerLoading(serverId, async () => {
      try {
        const state = await mcpRuntime.authenticate(serverId, config)
        serverStates.value = {
          ...serverStates.value,
          [serverId]: state,
        }
        toast.success(`${serverId} authenticated`)
      } catch (error) {
        serverStates.value = {
          ...serverStates.value,
          [serverId]: {
            serverId,
            status: 'auth_required',
            tools: [],
            error: error instanceof Error ? error.message : String(error),
          },
        }
        toast.error('Authentication failed', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
        throw error
      } finally {
        authenticatingServers.value = {
          ...authenticatingServers.value,
          [serverId]: false,
        }
      }
    })
  }

  const logoutServer = async (
    serverId: string,
    config?: McpServerConfig,
  ): Promise<void> => {
    try {
      const resolvedConfig =
        config ??
        listEffectiveMcpServers(personalMcp.value, projectMcp.value).find(
          (server) => server.id === serverId,
        )?.config
      await mcpRuntime.logout(serverId, resolvedConfig)
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

  const stopServer = async (
    serverId: string,
    options?: { quiet?: boolean; manageLoading?: boolean; config?: McpServerConfig },
  ): Promise<void> => {
    const run = async (): Promise<void> => {
      try {
        const resolvedConfig =
          options?.config ??
          listEffectiveMcpServers(personalMcp.value, projectMcp.value).find(
            (server) => server.id === serverId,
          )?.config
        await mcpRuntime.stop(serverId, resolvedConfig)
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
    }

    if (options?.manageLoading === false) {
      await run()
      return
    }
    await withServerLoading(serverId, run)
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
    await mcpRuntime.stop(serverId)
    await refreshStates()
  }

  const setServerEnabled = async (
    serverId: string,
    enabled: boolean,
    rootPath: string | null,
  ): Promise<void> => {
    const effective = listEffectiveMcpServers(personalMcp.value, projectMcp.value)
    const server = effective.find((item) => item.id === serverId)
    if (!server) {
      toast.error('MCP server not found', {
        description: serverId,
      })
      return
    }

    const tab: SettingsTab =
      server.scope === 'personal' ? 'personal' : 'project'
    const scoped = tab === 'personal' ? personalMcp.value : projectMcp.value
    const existing = scoped.servers[serverId]
    if (!existing) {
      toast.error('MCP server config missing', {
        description: `${serverId} (${tab})`,
      })
      return
    }

    if (tab === 'project' && !rootPath) {
      toast.error('Select a project to update this MCP server')
      return
    }

    const nextConfig: McpServerConfig = { ...existing, enabled }
    const nextScoped: McpConfig = {
      servers: {
        ...scoped.servers,
        [serverId]: nextConfig,
      },
    }

    // Optimistic UI so the switch moves immediately.
    if (tab === 'personal') {
      personalMcp.value = nextScoped
    } else {
      projectMcp.value = nextScoped
    }

    await withServerLoading(serverId, async () => {
      try {
        await saveScopedConfig(tab, nextScoped, rootPath)

        if (enabled) {
          await startServer(serverId, nextConfig, { quiet: true, manageLoading: false })
        } else {
          await stopServer(serverId, { quiet: true, manageLoading: false })
        }
        await refreshStates()
      } catch (error) {
        // Roll back optimistic enablement on failure.
        if (tab === 'personal') {
          personalMcp.value = scoped
        } else {
          projectMcp.value = scoped
        }
        throw error
      }
    })
  }

  return {
    personalMcp,
    projectMcp,
    serverStates,
    loadingServers,
    authenticatingServers,
    loadConfigs,
    refreshStates,
    startServer,
    stopServer,
    refreshServer,
    refreshOrStartServer,
    refreshAllServers,
    authenticateServer,
    logoutServer,
    addServer,
    deleteServer,
    setServerEnabled,
    listEffectiveMcpServers,
    listScopedMcpServers,
  }
}
