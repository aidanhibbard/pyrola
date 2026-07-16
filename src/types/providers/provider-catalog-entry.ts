export type ProviderCatalogCategory = 'ai-sdk' | 'openai-compatible'

export type ProviderCatalogEntry = {
  id: string
  name: string
  tier: 'first-party' | 'compatible'
  category: ProviderCatalogCategory
  defaultBaseUrl?: string
  models: string[]
  packageName?: string
  requiresApiKey?: boolean
}
