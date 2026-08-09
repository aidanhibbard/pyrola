import { ref } from 'vue'
import { toast } from 'vue-sonner'
import type { McpConfig, McpServerConfig } from '@/types/pyrola/mcp-config'
import { migrateMcpConfig } from '@/schemas/mcp-config'
import { listEffectiveMcpServers, listScopedMcpServers, listUserMcpServers } from '@/services/mcp/merge-mcp-config'
import stripCodegraphMcpServer from '@/services/codegraph/strip-codegraph-mcp-server'
import mcpRuntime, { type McpRuntimeOptions } from '@/services/mcp/mcp-runtime'
import { resolveMcpAuthForServer } from '@/services/mcp/mcp-auth-gate'
import { listRequiredInputIdsForServer } from '@/services/mcp/resolve-mcp-inputs'
import { mcpKnownSecretKeys } from '@/services/mcp/mcp-keychain-keys'
import { mcpServerFingerprint } from '@/services/mcp/mcp-server-fingerprint'
import { isMcpTrusted, sessionTrusts } from '@/services/mcp/mcp-trust'
import { isInternalMcpServer, CODEGRAPH_SERVER_ID } from '@/types/codegraph/managed-codegraph'
import {
  deleteSecret,
  readMcpConfig,
  writeMcpConfig,
  type McpServerState,
} from '@/services/pyrola/pyrola-tauri'
import type { SettingsTab } from '@/composables/use-pyrola-config'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import usePyrolaConfig from '@/composables/use-pyrola-config'

const isActiveStatus = (status: string): boolean =>
  status === 'connected' || status === 'starting' || status === 'refreshing'

const personalMcp = ref<McpConfig>({ servers: {} })
const projectMcp = ref<McpConfig>({ servers: {} })
const serverStates = ref<Record<string, McpServerState>>({})
const loadingServers = ref<Record<string, boolean>>({})
const authenticatingServers = ref<Record<string, boolean>>({})
const startInFlight = new Map<string, Promise<void>>()
let refreshGeneration = 0

export default () => {
  const config = usePyrolaConfig()

  const runtimeOptions = (
    extras?: Pick<McpRuntimeOptions, 'confirmAuthorizationServerOrigin' | 'skipTrustCheck'>,
  ): McpRuntimeOptions => ({
    settings: config.effectiveSettings.value as PyrolaSettings,
    ...extras,
  })

  const assertTrustedOrThrow = (serverId: string, serverConfig: McpServerConfig): void => {
    if (isInternalMcpServer(serverId)) {
      return
    }
    const fingerprint = mcpServerFingerprint(serverConfig)
    if (
      !isMcpTrusted(
        config.effectiveSettings.value,
        serverId,
        fingerprint,
        sessionTrusts,
      )
    ) {
      throw new Error(
        `MCP server "${serverId}" is not trusted for the current configuration`,
      )
    }
  }

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
    const personalMigrated = migrateMcpConfig(personalRaw)
    const personalHadCodegraph = CODEGRAPH_SERVER_ID in personalMigrated.servers
    const personal = stripCodegraphMcpServer(personalMigrated)
    personalMcp.value = personal
    if (personalHadCodegraph) {
      await writeMcpConfig('personal', personal, null)
    }

    if (rootPath) {
      const projectRaw = await readMcpConfig('project', rootPath)
      const projectMigrated = migrateMcpConfig(projectRaw)
      const projectHadCodegraph = CODEGRAPH_SERVER_ID in projectMigrated.servers
      const project = stripCodegraphMcpServer(projectMigrated)
      projectMcp.value = project
      if (projectHadCodegraph) {
        await writeMcpConfig('project', project, rootPath)
      }
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
      return {
        ...freshState,
        icons: freshState.icons ?? existing?.icons ?? null,
      }
    }

    const existingStatus = existing?.status ?? 'stopped'
    if (isActiveStatus(existingStatus)) {
      return existing ?? {
        serverId,
        status: existingStatus,
        tools: [],
        icons: null,
      }
    }

    return {
      serverId,
      status: 'stopped',
      tools: [],
      icons: existing?.icons ?? null,
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

    // Internal CodeGraph is runtime-only (not in user MCP JSON). Keep its state.
    if (
      previousIds.has(CODEGRAPH_SERVER_ID) ||
      bulkStatuses[CODEGRAPH_SERVER_ID] ||
      serverStates.value[CODEGRAPH_SERVER_ID]
    ) {
      previousIds.delete(CODEGRAPH_SERVER_ID)
      merged[CODEGRAPH_SERVER_ID] = mergeServerState(
        CODEGRAPH_SERVER_ID,
        bulkStatuses[CODEGRAPH_SERVER_ID],
        serverStates.value[CODEGRAPH_SERVER_ID],
      )
    }

    if (generation !== refreshGeneration) {
      return
    }

    for (const removedId of previousIds) {
      if (isInternalMcpServer(removedId)) {
        continue
      }
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
    const cleaned = stripCodegraphMcpServer(config)
    await writeMcpConfig(scope, cleaned, rootPath)
    if (scope === 'personal') {
      personalMcp.value = cleaned
    } else {
      projectMcp.value = cleaned
    }
  }

  const startServer = async (
    serverId: string,
    serverConfig: McpServerConfig,
    options?: { quiet?: boolean; manageLoading?: boolean },
  ): Promise<void> => {
    const existing = startInFlight.get(serverId)
    if (existing) {
      await existing
      return
    }

    const run = async (): Promise<void> => {
      try {
        assertTrustedOrThrow(serverId, serverConfig)
        const state = await mcpRuntime.start(
          serverId,
          serverConfig,
          runtimeOptions(),
        )
        serverStates.value = {
          ...serverStates.value,
          [serverId]: state,
        }
        if (!options?.quiet && !isInternalMcpServer(serverId)) {
          toast.success(`${serverId} connected (${state.tools.length} tools)`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        serverStates.value = {
          ...serverStates.value,
          [serverId]: {
            serverId,
            status: 'error',
            tools: [],
            error: message,
          },
        }
        if (!options?.quiet) {
          toast.error('Failed to start server', {
            description: message,
          })
          return
        }
        throw error instanceof Error ? error : new Error(message)
      }
    }

    const pending = (async () => {
      try {
        if (options?.manageLoading === false) {
          await run()
          return
        }
        await withServerLoading(serverId, run)
      } finally {
        startInFlight.delete(serverId)
      }
    })()
    startInFlight.set(serverId, pending)
    await pending
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
        if (!options?.quiet && !isInternalMcpServer(serverId)) {
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
    serverConfig: McpServerConfig,
    extras?: Pick<McpRuntimeOptions, 'confirmAuthorizationServerOrigin'>,
  ): Promise<void> => {
    authenticatingServers.value = {
      ...authenticatingServers.value,
      [serverId]: true,
    }
    await withServerLoading(serverId, async () => {
      try {
        assertTrustedOrThrow(serverId, serverConfig)
        const state = await mcpRuntime.authenticate(
          serverId,
          serverConfig,
          runtimeOptions(extras),
        )
        serverStates.value = {
          ...serverStates.value,
          [serverId]: state,
        }
        resolveMcpAuthForServer(serverId, { action: 'authenticated' })
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
        if (!options?.quiet && !isInternalMcpServer(serverId)) {
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
    if (isInternalMcpServer(serverId)) {
      throw new Error(`Reserved MCP server id "${serverId}"`)
    }
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

  const upsertServer = async (
    tab: SettingsTab,
    serverId: string,
    serverConfig: McpServerConfig,
    rootPath: string | null,
    options?: {
      previousId?: string
      inputs?: import('@/types/pyrola/mcp-config').McpInputDefinition[]
    },
  ): Promise<void> => {
    if (isInternalMcpServer(serverId) || (options?.previousId && isInternalMcpServer(options.previousId))) {
      throw new Error(`Reserved MCP server id "${serverId}"`)
    }
    const scoped = tab === 'personal' ? personalMcp.value : projectMcp.value
    const nextServers = { ...scoped.servers }
    const previousId = options?.previousId

    if (previousId && previousId !== serverId) {
      delete nextServers[previousId]
      await mcpRuntime.stop(previousId)
      const previous = scoped.servers[previousId]
      if (previous) {
        for (const key of mcpKnownSecretKeys(
          previousId,
          listRequiredInputIdsForServer(previous),
        )) {
          try {
            await deleteSecret(key)
          } catch {
            // Best-effort.
          }
        }
      }
    }

    const existing = previousId
      ? scoped.servers[previousId]
      : scoped.servers[serverId]
    if (
      existing &&
      mcpServerFingerprint(existing) !== mcpServerFingerprint(serverConfig)
    ) {
      for (const key of mcpKnownSecretKeys(
        previousId && previousId !== serverId ? previousId : serverId,
        listRequiredInputIdsForServer(existing),
      )) {
        try {
          await deleteSecret(key)
        } catch {
          // Best-effort on fingerprint change.
        }
      }
      sessionTrusts.delete(serverId)
      if (previousId) {
        sessionTrusts.delete(previousId)
      }
    }

    nextServers[serverId] = serverConfig

    let nextInputs = scoped.inputs
    if (options?.inputs) {
      const byId = new Map((scoped.inputs ?? []).map((item) => [item.id, item]))
      for (const item of options.inputs) {
        byId.set(item.id, item)
      }
      nextInputs = [...byId.values()]
    }

    await saveScopedConfig(
      tab,
      {
        servers: nextServers,
        ...(nextInputs && nextInputs.length > 0 ? { inputs: nextInputs } : {}),
      },
      rootPath,
    )
    await refreshStates()
  }

  const deleteServer = async (
    tab: SettingsTab,
    serverId: string,
    rootPath: string | null,
  ): Promise<void> => {
    const scoped = tab === 'personal' ? personalMcp.value : projectMcp.value
    const removed = scoped.servers[serverId]
    const { [serverId]: _removed, ...rest } = scoped.servers
    await saveScopedConfig(tab, { servers: rest }, rootPath)
    await mcpRuntime.stop(serverId, removed)
    if (removed) {
      const inputIds = listRequiredInputIdsForServer(removed)
      for (const key of mcpKnownSecretKeys(serverId, inputIds)) {
        try {
          await deleteSecret(key)
        } catch {
          // Best-effort keychain cleanup.
        }
      }
    }
    await refreshStates()
  }

  const updateServer = async (
    tab: SettingsTab,
    serverId: string,
    serverConfig: McpServerConfig,
    rootPath: string | null,
    previousId?: string,
  ): Promise<void> => {
    await upsertServer(tab, serverId, serverConfig, rootPath, { previousId })
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

    if (enabled) {
      assertTrustedOrThrow(serverId, server.config)
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
    updateServer,
    upsertServer,
    deleteServer,
    setServerEnabled,
    listEffectiveMcpServers,
    listUserMcpServers,
    listScopedMcpServers,
  }
}
