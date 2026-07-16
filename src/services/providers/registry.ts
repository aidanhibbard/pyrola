import aiSdkProviderCatalog from '@/data/ai-sdk-provider-catalog'
import type { ProviderCatalogEntry } from '@/types/providers/provider-catalog-entry'

export type { ProviderCatalogEntry } from '@/types/providers/provider-catalog-entry'

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = aiSdkProviderCatalog

export const AI_SDK_PROVIDER_CATALOG = PROVIDER_CATALOG.filter(
  (entry) => entry.category === 'ai-sdk',
)

export const OPENAI_COMPATIBLE_PROVIDER_CATALOG = PROVIDER_CATALOG.filter(
  (entry) => entry.category === 'openai-compatible',
)

export const getProviderCatalogEntry = (id: string): ProviderCatalogEntry | undefined =>
  PROVIDER_CATALOG.find((entry) => entry.id === id)

export const providerKeyRef = (providerId: string): string => providerId

export const keychainKeyForProvider = (apiKeyRef: string): string =>
  `pyrola:provider:${apiKeyRef}`

export const providerRequiresApiKey = (providerId: string): boolean => {
  const entry = getProviderCatalogEntry(providerId)
  if (!entry) {
    return true
  }
  return entry.requiresApiKey !== false
}
