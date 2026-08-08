import { auth, type OAuthClientProvider } from '@ai-sdk/mcp'
import { listen } from '@tauri-apps/api/event'
import type { McpHttpServer, McpServerConfig } from '@/types/pyrola/mcp-config'
import { isMcpHttpServer, isMcpStdioServer } from '@/types/pyrola/mcp-config'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import { isAllowedMcpUrl } from '@/services/mcp/is-allowed-mcp-url'
import { assertSafeMcpEnvOverlay } from '@/services/mcp/mcp-dangerous-env'
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
import { mcpOAuthFetch } from '@/services/mcp/mcp-oauth-fetch'
import { mcpServerFingerprint } from '@/services/mcp/mcp-server-fingerprint'
import { createPyrolaOAuthProvider } from '@/services/mcp/pyrola-oauth-provider'
import {
  listRequiredInputIdsForServer,
  resolveServerTemplates,
} from '@/services/mcp/resolve-mcp-inputs'
import { isMcpTrusted, sessionTrusts } from '@/services/mcp/mcp-trust'
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
  state: string
  error?: string | null
}

export type McpRuntimeOptions = {
  settings?: PyrolaSettings
  confirmAuthorizationServerOrigin?: (origin: string) => Promise<boolean>
  skipTrustCheck?: boolean
}

const OAUTH_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000
const oauthInFlight = new Map<string, Promise<McpServerState>>()

const clearServerSecrets = async (
  serverId: string,
  config?: McpServerConfig,
): Promise<void> => {
  const inputIds = config ? listRequiredInputIdsForServer(config) : []
  for (const key of mcpKnownSecretKeys(serverId, inputIds)) {
    await deleteSecret(key)
  }
}

const assertServerTrusted = (
  serverId: string,
  config: McpServerConfig,
  options?: McpRuntimeOptions,
): void => {
  if (options?.skipTrustCheck) {
    return
  }
  const settings = options?.settings
  if (!settings) {
    throw new Error('MCP trust check requires settings')
  }
  const fingerprint = mcpServerFingerprint(config)
  if (!isMcpTrusted(settings, serverId, fingerprint, sessionTrusts)) {
    throw new Error(
      `MCP server "${serverId}" is not trusted for the current configuration`,
    )
  }
}

const createTokenProvider = (
  serverId: string,
  config: McpHttpServer,
  redirectUrl: string,
  openUrl: (url: string, allowedOrigin: string) => Promise<void>,
  confirmAuthorizationServerOrigin?: (origin: string) => Promise<boolean>,
): OAuthClientProvider =>
  createPyrolaOAuthProvider({
    serverId,
    serverUrl: config.url,
    clientId: config.oauth?.clientId,
    allowedAuthorizationServers: config.oauth?.allowedAuthorizationServers,
    redirectUrl,
    openUrl,
    confirmAuthorizationServerOrigin,
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
        if (event.payload.error) {
          settle('reject', new Error(event.payload.error))
          return
        }
        if (!event.payload.state) {
          settle('reject', new Error('OAuth callback missing state'))
          return
        }
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
  options?: McpRuntimeOptions,
  authProvider?: OAuthClientProvider,
): Promise<McpServerState> => {
  assertServerTrusted(serverId, config, options)

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

  const provider =
    authProvider ??
    createTokenProvider(
      serverId,
      resolvedConfig,
      'http://127.0.0.1/oauth-pending',
      async () => {
        throw new Error('OAuth redirect requires authenticate()')
      },
      options?.confirmAuthorizationServerOrigin,
    )

  try {
    return await startHttpServer(serverId, resolvedConfig, {
      authProvider: provider,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      /unauthorized|401|auth_required/i.test(message) ||
      error instanceof Error && error.name === 'UnauthorizedError'
    ) {
      return markHttpAuthRequired(serverId, resolvedConfig, message)
    }
    throw error
  }
}

const startStdio = async (
  serverId: string,
  config: Extract<McpServerConfig, { command: string }>,
  options?: McpRuntimeOptions,
): Promise<McpServerState> => {
  assertServerTrusted(serverId, config, options)

  let args = config.args ?? []
  let serverEnv: Record<string, string> | undefined
  try {
    const resolved = await resolveServerTemplates(serverId, config)
    if (resolved.args) {
      args = resolved.args
    }
    if (resolved.serverEnv) {
      serverEnv = assertSafeMcpEnvOverlay(resolved.serverEnv)
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

  return mcpStart(serverId, config.command, args, serverEnv)
}

const start = async (
  serverId: string,
  config: McpServerConfig,
  options?: McpRuntimeOptions,
): Promise<McpServerState> => {
  if (isMcpHttpServer(config)) {
    return startHttp(serverId, config, options)
  }
  if (isMcpStdioServer(config)) {
    return startStdio(serverId, config, options)
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

const runAuthenticateHttp = async (
  serverId: string,
  config: McpHttpServer,
  options?: McpRuntimeOptions,
): Promise<McpServerState> => {
  assertServerTrusted(serverId, config, options)

  const loopback = await oauthBeginLoopback()
  const abort = new AbortController()
  const callbackPromise = waitForOAuthCallback(abort.signal)

  try {
    const provider = createTokenProvider(
      serverId,
      config,
      loopback.redirectUrl,
      async (url: string, allowedOrigin: string) => {
        await openExternalUrl(url, allowedOrigin)
      },
      options?.confirmAuthorizationServerOrigin,
    )

    const first = await auth(provider, {
      serverUrl: config.url,
      fetchFn: mcpOAuthFetch,
    })
    if (first === 'REDIRECT') {
      const callback = await callbackPromise
      const second = await auth(provider, {
        serverUrl: config.url,
        authorizationCode: callback.code,
        callbackState: callback.state,
        fetchFn: mcpOAuthFetch,
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

    return startHttp(serverId, config, options, provider)
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

const authenticate = async (
  serverId: string,
  config: McpServerConfig,
  options?: McpRuntimeOptions,
): Promise<McpServerState> => {
  if (!isMcpHttpServer(config)) {
    return start(serverId, config, options)
  }

  const existing = oauthInFlight.get(serverId)
  if (existing) {
    return existing
  }

  const flight = runAuthenticateHttp(serverId, config, options).finally(() => {
    oauthInFlight.delete(serverId)
  })
  oauthInFlight.set(serverId, flight)
  return flight
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
