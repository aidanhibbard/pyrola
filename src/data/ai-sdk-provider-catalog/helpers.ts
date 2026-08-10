import type { ProviderCatalogEntry } from '@/types/providers/provider-catalog-entry'

export const aiSdk = (
  entry: Omit<ProviderCatalogEntry, 'tier' | 'category'>,
): ProviderCatalogEntry => ({
  tier: 'first-party',
  category: 'ai-sdk',
  requiresApiKey: entry.requiresApiKey ?? true,
  ...entry,
})

export const openAiCompatible = (
  entry: Omit<ProviderCatalogEntry, 'tier' | 'category'>,
): ProviderCatalogEntry => ({
  tier: 'compatible',
  category: 'openai-compatible',
  requiresApiKey: entry.requiresApiKey ?? true,
  ...entry,
})
