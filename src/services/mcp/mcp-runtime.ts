import { auth, type OAuthClientProvider } from '@ai-sdk/mcp'
import { listen } from '@tauri-apps/api/event'
import type { McpHttpServer, McpServerConfig } from '@/types/pyrola/mcp-config'
import { isMcpHttpServer, isMcpStdioServer } from '@/types/pyrola/mcp-config'
import { isAllowedMcpUrl } from '@/services/mcp/is-allowed-mcp-url'
import {
  callHttpTool,
  getHttpPrompt,
  getHttpState,
  hasHttpServer,
  listHttpPrompts,
  listHttpResources,
  listHttpStates,
  logoutHttpServer,
  markHttpAuthRequired,
  readHttpResource,
  refreshHttpServer,
  startHttpServer,
  stopHttpServer,
} from '@/services/mcp/mcp-http-client'
import { mcpKnownSecretKeys } from '@/services/mcp/mcp-keychain-keys'
import { createPyrolaOAuthProvider } from '@/services/mcp/pyrola-oauth-provider'
import {
  listRequiredInputIdsForServer,
  resolveServerTemplates,
} from '@/services/mcp/resolve-mcp-inputs'
import {
  deleteSecret,
  mcpCallTool,
  mcpListStatuses,
  mcpLogout,
  mcpRefresh,
  mcpStart,
  mcpStatus,
  mcpStop,
  oauthBeginLoopback,
  oauthCancelLoopback,
  openExternalUrl,
  type McpServerState,
} from '@/services/pyrola/pyrola-tauri'

type OAuthCallbackPayload = {
  code: string
  state?: string
}

const OAUTH_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000

const clearServerSecrets = async (
  serverId: string,
  config?: McpServerConfig,
): Promise<void> => {
  const inputIds = config ? listRequiredInputIdsForServer(config) : []
  for (const key of mcpKnownSecretKeys(serverId, inputIds)) {
    await deleteSecret(key)
  }
}

const createTokenProvider = (
  serverId: string,
  config: McpHttpServer,
  redirectUrl: string,
  openUrl: (url: string) => Promise<void>,
): OAuthClientProvider =>
  createPyrolaOAuthProvider({
    serverId,
    serverUrl: config.url,
    clientId: config.oauth?.clientId,
    allowedAuthorizationServers: config.oauth?.allowedAuthorizationServers,
    redirectUrl,
    openUrl,
  })

const waitForOAuthCallback = async (
  signal: AbortSignal,
): Promise<OAuthCallbackPayload> => {
  let unlisten: (() => void) | undefined
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let settled = false
  let onAbort: (() => void) | undefined

  const cleanup = (): void => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }
    if (onAbort) {
      signal.removeEventListener('abort', onAbort)
      onAbort = undefined
    }
    if (unlisten) {
      unlisten()
      unlisten = undefined
    }
  }

  try {
    return await new Promise<OAuthCallbackPayload>((resolve, reject) => {
      const settle = (
        action: 'resolve' | 'reject',
        value: OAuthCallbackPayload | Error,
      ): void => {
        if (settled) {
          return
        }
        settled = true
        cleanup()
        if (action === 'resolve') {
          resolve(value as OAuthCallbackPayload)
          return
        }
        reject(value)
      }

      if (signal.aborted) {
        settle('reject', new Error('OAuth callback aborted'))
        return
      }

      onAbort = (): void => {
        settle('reject', new Error('OAuth callback aborted'))
      }
      signal.addEventListener('abort', onAbort)

      timeoutId = setTimeout(() => {
        settle('reject', new Error('OAuth callback timed out'))
      }, OAUTH_CALLBACK_TIMEOUT_MS)

      listen<OAuthCallbackPayload>('oauth-callback', (event) => {
        settle('resolve', event.payload)
      })
        .then((fn) => {
          if (settled) {
            fn()
            return
          }
          unlisten = fn
          if (signal.aborted) {
            settle('reject', new Error('OAuth callback aborted'))
          }
        })
        .catch((error: unknown) => {
          settle(
            'reject',
            error instanceof Error ? error : new Error(String(error)),
          )
        })
    })
  } finally {
    cleanup()
  }
}

const startHttp = async (
  serverId: string,
  config: McpHttpServer,
  authProvider?: OAuthClientProvider,
): Promise<McpServerState> => {
  if (!isAllowedMcpUrl(config.url)) {
    throw new Error(
      'MCP URL must use https, or http on localhost / 127.0.0.1',
    )
  }

  let headers: Record<string, string> | undefined
  try {
    const resolved = await resolveServerTemplates(serverId, config)
    headers = resolved.headers
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('Missing MCP inputs')
    ) {
      markHttpAuthRequired(serverId, config, 'auth_required:inputs')
      throw new Error('auth_required:inputs')
    }
    throw error
  }

  const resolvedConfig: McpHttpServer = {
    ...config,
    headers,
  }

  if (config.oauth) {
    const provider =
      authProvider ??
      createTokenProvider(
        serverId,
        resolvedConfig,
        'http://127.0.0.1/oauth-pending',
        async () => {
          throw new Error('OAuth redirect requires authenticate()')
        },
      )
    const tokens = await provider.tokens()
    if (!tokens?.access_token) {
      return markHttpAuthRequired(serverId, resolvedConfig, 'Authentication required')
    }
    return startHttpServer(serverId, resolvedConfig, { authProvider: provider })
  }

  return startHttpServer(serverId, resolvedConfig, {
    authProvider,
  })
}

const startStdio = async (
  serverId: string,
  config: Extract<McpServerConfig, { command: string }>,
): Promise<McpServerState> => {
  let args = config.args ?? []
  try {
    const resolved = await resolveServerTemplates(serverId, config)
    if (resolved.args) {
      args = resolved.args
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('Missing MCP inputs')
    ) {
      throw new Error('auth_required:inputs')
    }
    throw error
  }

  return mcpStart(serverId, config.command, args)
}

const start = async (
  serverId: string,
  config: McpServerConfig,
): Promise<McpServerState> => {
  if (isMcpHttpServer(config)) {
    return startHttp(serverId, config)
  }
  if (isMcpStdioServer(config)) {
    return startStdio(serverId, config)
  }
  throw new Error('Unsupported MCP server config')
}

const stop = async (
  serverId: string,
  config?: McpServerConfig,
): Promise<void> => {
  if (config ? isMcpHttpServer(config) : hasHttpServer(serverId)) {
    await stopHttpServer(serverId)
    return
  }
  await mcpStop(serverId)
}

const refresh = async (
  serverId: string,
  config?: McpServerConfig,
): Promise<McpServerState> => {
  if (config ? isMcpHttpServer(config) : hasHttpServer(serverId)) {
    return refreshHttpServer(serverId)
  }
  return mcpRefresh(serverId)
}

const logout = async (
  serverId: string,
  config?: McpServerConfig,
): Promise<void> => {
  await clearServerSecrets(serverId, config)

  if (config ? isMcpHttpServer(config) : hasHttpServer(serverId)) {
    await logoutHttpServer(
      serverId,
      config && isMcpHttpServer(config) ? config : undefined,
    )
    return
  }

  await mcpLogout(serverId)
}

const authenticate = async (
  serverId: string,
  config: McpServerConfig,
): Promise<McpServerState> => {
  if (!isMcpHttpServer(config)) {
    return start(serverId, config)
  }

  if (!config.oauth) {
    return startHttp(serverId, config)
  }

  const loopback = await oauthBeginLoopback()
  const abort = new AbortController()
  const callbackPromise = waitForOAuthCallback(abort.signal)

  try {
    const provider = createTokenProvider(
      serverId,
      config,
      loopback.redirectUrl,
      async (url: string) => {
        await openExternalUrl(url)
      },
    )

    const first = await auth(provider, { serverUrl: config.url })
    if (first === 'REDIRECT') {
      const callback = await callbackPromise
      const second = await auth(provider, {
        serverUrl: config.url,
        authorizationCode: callback.code,
        callbackState: callback.state,
      })
      if (second !== 'AUTHORIZED') {
        throw new Error('OAuth authorization did not complete')
      }
    } else if (first !== 'AUTHORIZED') {
      throw new Error('OAuth authorization did not complete')
    } else {
      abort.abort()
      try {
        await callbackPromise
      } catch (callbackError) {
        if (
          !(callbackError instanceof Error) ||
          !callbackError.message.includes('aborted')
        ) {
          throw callbackError
        }
      }
    }

    return startHttp(serverId, config, provider)
  } catch (error) {
    abort.abort()
    try {
      await callbackPromise
    } catch {
      // Expected when aborting the pending OAuth callback wait.
    }
    markHttpAuthRequired(
      serverId,
      config,
      error instanceof Error ? error.message : 'Authentication failed',
    )
    throw error
  } finally {
    try {
      await oauthCancelLoopback()
    } catch {
      // Loopback may already be closed after a successful callback.
    }
  }
}

const callTool = async (
  serverId: string,
  tool: string,
  args: Record<string, unknown>,
  config?: McpServerConfig,
): Promise<unknown> => {
  if (config ? isMcpHttpServer(config) : hasHttpServer(serverId)) {
    return callHttpTool(serverId, tool, args)
  }
  return mcpCallTool(serverId, tool, args)
}

const listStatuses = async (): Promise<Record<string, McpServerState>> => {
  const stdio = await mcpListStatuses()
  return {
    ...stdio,
    ...listHttpStates(),
  }
}

const getStatus = async (
  serverId: string,
  config?: McpServerConfig,
): Promise<McpServerState> => {
  if (config ? isMcpHttpServer(config) : hasHttpServer(serverId)) {
    const httpState = getHttpState(serverId)
    if (httpState) {
      return httpState
    }
    return {
      serverId,
      status: 'stopped',
      tools: [],
      error: null,
    }
  }
  return mcpStatus(serverId)
}

const listResources = async (serverId: string): Promise<unknown> => {
  if (!hasHttpServer(serverId)) {
    throw new Error('MCP resources require a connected HTTP or SSE server')
  }
  return listHttpResources(serverId)
}

const readResource = async (serverId: string, uri: string): Promise<unknown> => {
  if (!hasHttpServer(serverId)) {
    throw new Error('MCP resources require a connected HTTP or SSE server')
  }
  return readHttpResource(serverId, uri)
}

const listPrompts = async (serverId: string): Promise<unknown> => {
  if (!hasHttpServer(serverId)) {
    throw new Error('MCP prompts require a connected HTTP or SSE server')
  }
  return listHttpPrompts(serverId)
}

const getPrompt = async (
  serverId: string,
  name: string,
  promptArgs?: Record<string, unknown>,
): Promise<unknown> => {
  if (!hasHttpServer(serverId)) {
    throw new Error('MCP prompts require a connected HTTP or SSE server')
  }
  return getHttpPrompt(serverId, name, promptArgs)
}

const mcpRuntime = {
  start,
  stop,
  refresh,
  logout,
  authenticate,
  callTool,
  listStatuses,
  getStatus,
  listResources,
  readResource,
  listPrompts,
  getPrompt,
}

export default mcpRuntime
