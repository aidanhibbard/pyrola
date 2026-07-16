export type PyrolaTheme = 'light' | 'dark' | 'system'

export type PyrolaGlassVariant = 'light' | 'dark'

export type PyrolaChatMode = 'ask' | 'plan' | 'studio' | 'agent'

export type PyrolaCustomProvider = {
  type: 'openai-compatible'
  baseURL: string
  apiKeyRef?: string
  name: string
}

export type PyrolaSettings = {
  version: 1
  'appearance.theme'?: PyrolaTheme
  'appearance.glass'?: boolean
  'appearance.glassVariant'?: PyrolaGlassVariant
  'agent.defaultProvider'?: string
  'agent.defaultModel'?: string
  'agent.defaultMode'?: PyrolaChatMode
  'fleet.maxConcurrentAgents'?: number
  'fleet.trayBackground'?: boolean
  'general.machineLabel'?: string
  [key: `providers.${string}.apiKeyRef`]: string | undefined
  [key: `providers.custom.${string}`]: PyrolaCustomProvider | undefined
}
