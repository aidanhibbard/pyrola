export type PyrolaTheme = 'light' | 'dark' | 'system'

export type PyrolaChatMode = 'ask' | 'plan' | 'studio' | 'agent' | 'orchestrator'

export type PyrolaDuplicateTabBehavior = 'ask' | 'open-existing' | 'open-new'

export type PyrolaCustomProviderModel = {
  id: string
  name?: string
  maxInputTokens?: number
  maxOutputTokens?: number
  contextWindow?: number
  toolCalling?: boolean
  vision?: boolean
  thinking?: boolean
  streaming?: boolean
  supportsReasoningEffort?: string[]
  reasoningEffort?: string
  temperature?: number
  topP?: number
  topK?: number
  frequencyPenalty?: number
  presencePenalty?: number
  seed?: number
  headers?: Record<string, string>
  modelOptions?: Record<string, unknown>
}

export type PyrolaCustomProvider = {
  type: 'openai-compatible'
  baseURL: string
  apiKeyRef?: string
  name: string
  headers?: Record<string, string>
  queryParams?: Record<string, string>
  includeUsage?: boolean
  supportsStructuredOutputs?: boolean
  models?: PyrolaCustomProviderModel[]
}

export type PyrolaSettings = {
  version: 1
  'appearance.theme'?: PyrolaTheme
  'appearance.fontSize'?: number
  'agent.defaultMode'?: PyrolaChatMode
  'agent.autoApproveGlobs'?: string[]
  'fleet.maxConcurrentAgents'?: number
  'fleet.trayBackground'?: boolean
  'general.machineLabel'?: string
  'lsp.enabled'?: boolean
  'chat.autoTitle'?: boolean
  'workbench.duplicateTabBehavior'?: PyrolaDuplicateTabBehavior
  'models.default'?: string
  'models.ask'?: string
  'models.plan'?: string
  'models.studio'?: string
  'models.agent'?: string
  'models.orchestrator'?: string
  'models.title'?: string
  'models.compaction'?: string
  [key: `providers.${string}.apiKeyRef`]: string | undefined
  [key: `providers.custom.${string}`]: PyrolaCustomProvider | undefined
  [key: `models.${string}`]: string | undefined
}
