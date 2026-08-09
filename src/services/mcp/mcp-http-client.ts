import {
  createMCPClient,
  ElicitationRequestSchema,
  UnauthorizedError,
  type ElicitResult,
  type ElicitationRequest,
  type MCPClient,
  type OAuthClientProvider,
} from '@ai-sdk/mcp'
import type { McpHttpServer } from '@/types/pyrola/mcp-config'
import { isAllowedMcpUrl } from '@/services/mcp/is-allowed-mcp-url'
import {
  detectMcpToolDrift,
  loadMcpToolBaseline,
  saveMcpToolBaseline,
} from '@/services/mcp/mcp-tool-baseline'
import parseMcpIcons from '@/services/mcp/parse-mcp-icons'
import type { McpServerState, McpToolInfo } from '@/services/pyrola/pyrola-tauri'
import type { McpIcon } from '@/types/mcp/mcp-icon'

type McpElicitationHandler = (
  request: ElicitationRequest,
) => Promise<ElicitResult> | ElicitResult

let elicitationHandler: McpElicitationHandler | null = null

export const setMcpElicitationHandler = (
  handler: McpElicitationHandler | null,
): McpElicitationHandler | null => {
  const previous = elicitationHandler
  elicitationHandler = handler
  return previous
}

type HttpServerEntry = {
  client: MCPClient | null
  state: McpServerState
  config: McpHttpServer
  authProvider?: OAuthClientProvider
}

const httpServers = new Map<string, HttpServerEntry>()

const toToolInfo = (tool: {
  name: string
  description?: string
  inputSchema?: unknown
  _meta?: Record<string, unknown>
}): McpToolInfo => ({
  name: tool.name,
  description: tool.description ?? null,
  inputSchema:
    tool.inputSchema && typeof tool.inputSchema === 'object'
      ? (tool.inputSchema as Record<string, unknown>)
      : null,
  meta: tool._meta ?? null,
})

const iconsFromClient = (client: MCPClient): McpIcon[] | null =>
  parseMcpIcons((client.serverInfo as { icons?: unknown }).icons)

const setEntryState = (
  serverId: string,
  patch: Partial<McpServerState> & Pick<McpServerState, 'status'>,
  extras?: Partial<Pick<HttpServerEntry, 'client' | 'config' | 'authProvider'>>,
): McpServerState => {
  const existing = httpServers.get(serverId)
  const state: McpServerState = {
    serverId,
    status: patch.status,
    error: patch.error ?? null,
    tools: patch.tools ?? existing?.state.tools ?? [],
    icons:
      patch.icons !== undefined ? patch.icons : (existing?.state.icons ?? null),
  }
  httpServers.set(serverId, {
    client: extras?.client !== undefined ? extras.client : (existing?.client ?? null),
    config: extras?.config ?? existing?.config ?? { type: 'http', url: '' },
    authProvider:
      extras?.authProvider !== undefined
        ? extras.authProvider
        : existing?.authProvider,
    state,
  })
  return state
}

const isUnauthorized = (error: unknown): boolean =>
  error instanceof UnauthorizedError ||
  (error instanceof Error &&
    (error.name === 'UnauthorizedError' ||
      /401|unauthorized/i.test(error.message)))

export const startHttpServer = async (
  serverId: string,
  config: McpHttpServer,
  options?: { authProvider?: OAuthClientProvider },
): Promise<McpServerState> => {
  if (!isAllowedMcpUrl(config.url)) {
    throw new Error(
      'MCP URL must use https, or http on localhost / 127.0.0.1',
    )
  }

  await stopHttpServer(serverId)
  setEntryState(
    serverId,
    { status: 'starting', tools: [], error: null },
    { client: null, config, authProvider: options?.authProvider },
  )

  try {
    const client = await createMCPClient({
      transport: {
        type: config.type,
        url: config.url,
        headers: config.headers,
        authProvider: options?.authProvider,
        redirect: 'error',
      },
      maxRetries: 0,
      clientName: 'Pyrola',
      capabilities: {
        elicitation: {},
      },
    })

    client.onElicitationRequest(ElicitationRequestSchema, async (request) => {
      if (!elicitationHandler) {
        return { action: 'cancel' }
      }
      return elicitationHandler(request)
    })

    const listed = await client.listTools()
    const tools = listed.tools.map(toToolInfo)
    const icons = iconsFromClient(client)
    const fingerprintSources = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }))
    const baseline = await loadMcpToolBaseline(serverId)
    if (baseline) {
      const drift = await detectMcpToolDrift(serverId, fingerprintSources)
      if (drift.drifted) {
        await client.close()
        return setEntryState(
          serverId,
          {
            status: 'error',
            tools,
            icons,
            error: `Tool definitions changed (${[...drift.changed, ...drift.added].join(', ') || 'unknown'}). Re-trust this server in Settings.`,
          },
          { client: null, config, authProvider: options?.authProvider },
        )
      }
    } else {
      await saveMcpToolBaseline(serverId, fingerprintSources)
    }

    return setEntryState(
      serverId,
      { status: 'connected', tools, icons, error: null },
      { client, config, authProvider: options?.authProvider },
    )
  } catch (error) {
    if (isUnauthorized(error)) {
      return setEntryState(
        serverId,
        {
          status: 'auth_required',
          tools: [],
          error: error instanceof Error ? error.message : 'Authentication required',
        },
        { client: null, config, authProvider: options?.authProvider },
      )
    }

    const message = error instanceof Error ? error.message : 'Failed to connect'
    setEntryState(
      serverId,
      { status: 'error', tools: [], error: message },
      { client: null, config, authProvider: options?.authProvider },
    )
    throw error instanceof Error ? error : new Error(message)
  }
}

export const stopHttpServer = async (serverId: string): Promise<void> => {
  const entry = httpServers.get(serverId)
  if (!entry) {
    return
  }

  if (entry.client) {
    try {
      await entry.client.close()
    } catch {
      // Client may already be closed.
    }
  }

  setEntryState(
    serverId,
    { status: 'stopped', tools: [], error: null },
    { client: null, config: entry.config, authProvider: entry.authProvider },
  )
}

export const refreshHttpServer = async (
  serverId: string,
): Promise<McpServerState> => {
  const entry = httpServers.get(serverId)
  if (!entry?.client) {
    throw new Error('Server not running')
  }

  setEntryState(serverId, {
    status: 'refreshing',
    tools: entry.state.tools,
    error: null,
  })

  try {
    const listed = await entry.client.listTools()
    const tools = listed.tools.map(toToolInfo)
    const icons = iconsFromClient(entry.client)
    const fingerprintSources = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }))
    const drift = await detectMcpToolDrift(serverId, fingerprintSources)
    if (drift.drifted) {
      await entry.client.close()
      return setEntryState(
        serverId,
        {
          status: 'error',
          tools,
          icons,
          error: `Tool definitions changed (${[...drift.changed, ...drift.added].join(', ') || 'unknown'}). Re-trust this server in Settings.`,
        },
        { client: null },
      )
    }
    return setEntryState(serverId, {
      status: 'connected',
      tools,
      icons,
      error: null,
    })
  } catch (error) {
    if (isUnauthorized(error)) {
      return setEntryState(serverId, {
        status: 'auth_required',
        tools: [],
        error: error instanceof Error ? error.message : 'Authentication required',
      })
    }
    const message = error instanceof Error ? error.message : 'Refresh failed'
    setEntryState(serverId, {
      status: 'error',
      tools: entry.state.tools,
      error: message,
    })
    throw error instanceof Error ? error : new Error(message)
  }
}

export const listHttpResources = async (serverId: string): Promise<unknown> => {
  const entry = httpServers.get(serverId)
  if (!entry?.client) {
    throw new Error('Server not running')
  }
  return entry.client.listResources()
}

export const readHttpResource = async (
  serverId: string,
  uri: string,
): Promise<unknown> => {
  const entry = httpServers.get(serverId)
  if (!entry?.client) {
    throw new Error('Server not running')
  }
  return entry.client.readResource({ uri })
}

export const listHttpPrompts = async (serverId: string): Promise<unknown> => {
  const entry = httpServers.get(serverId)
  if (!entry?.client) {
    throw new Error('Server not running')
  }
  return entry.client.experimental_listPrompts()
}

export const getHttpPrompt = async (
  serverId: string,
  name: string,
  promptArgs?: Record<string, unknown>,
): Promise<unknown> => {
  const entry = httpServers.get(serverId)
  if (!entry?.client) {
    throw new Error('Server not running')
  }
  return entry.client.experimental_getPrompt({
    name,
    arguments: promptArgs,
  })
}

export const callHttpTool = async (
  serverId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const entry = httpServers.get(serverId)
  if (!entry?.client) {
    throw new Error('Server not running')
  }

  try {
    return await entry.client.callTool({
      name,
      arguments: args,
    })
  } catch (error) {
    if (isUnauthorized(error)) {
      setEntryState(serverId, {
        status: 'auth_required',
        tools: entry.state.tools,
        error: error instanceof Error ? error.message : 'Authentication required',
      })
    }
    throw error
  }
}

export const getHttpState = (serverId: string): McpServerState | undefined =>
  httpServers.get(serverId)?.state

export const listHttpStates = (): Record<string, McpServerState> => {
  const states: Record<string, McpServerState> = {}
  for (const [serverId, entry] of httpServers) {
    states[serverId] = entry.state
  }
  return states
}

export const hasHttpServer = (serverId: string): boolean =>
  httpServers.has(serverId)

export const markHttpAuthRequired = (
  serverId: string,
  config: McpHttpServer,
  error?: string | null,
): McpServerState =>
  setEntryState(
    serverId,
    {
      status: 'auth_required',
      tools: [],
      error: error ?? null,
    },
    { client: null, config, authProvider: undefined },
  )

export const logoutHttpServer = async (
  serverId: string,
  config?: McpHttpServer,
): Promise<McpServerState> => {
  const entry = httpServers.get(serverId)
  if (entry?.client) {
    try {
      await entry.client.close()
    } catch {
      // Client may already be closed.
    }
  }

  return setEntryState(
    serverId,
    { status: 'auth_required', tools: [], error: null },
    {
      client: null,
      config: config ?? entry?.config ?? { type: 'http', url: '' },
      authProvider: undefined,
    },
  )
}
