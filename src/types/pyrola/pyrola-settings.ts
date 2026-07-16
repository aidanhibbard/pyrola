export type PyrolaTheme = 'light' | 'dark' | 'system'

export type PyrolaChatMode = 'ask' | 'plan' | 'studio' | 'agent'

export type PyrolaCustomProvider = {
  type: 'openai-compatible'
  baseURL: string
  apiKeyRef?: string
  name: string
}

export type PyrolaSearchProvider = 'tavily' | 'brave' | 'custom'

export type PyrolaSettings = {
  version: 1
  'appearance.theme'?: PyrolaTheme
  'agent.defaultProvider'?: string
  'agent.defaultModel'?: string
  'agent.defaultMode'?: PyrolaChatMode
  'agent.autoApproveGlobs'?: string[]
  'fleet.maxConcurrentAgents'?: number
  'fleet.trayBackground'?: boolean
  'general.machineLabel'?: string
  'search.provider'?: PyrolaSearchProvider
  'search.apiKeyRef'?: string
  'search.customBaseUrl'?: string
  'lsp.enabled'?: boolean
  'chat.autoTitle'?: boolean
  'chat.autoTitleModel'?: string
  [key: `providers.${string}.apiKeyRef`]: string | undefined
  [key: `providers.custom.${string}`]: PyrolaCustomProvider | undefined
}
