import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'

export type OAuthCallbackPayload = {
  code: string
  state: string
  error?: string | null
}

export type McpRuntimeOptions = {
  settings?: PyrolaSettings
  confirmAuthorizationServerOrigin?: (origin: string) => Promise<boolean>
  skipTrustCheck?: boolean
}

export const OAUTH_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000
