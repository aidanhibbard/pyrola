import type { PyrolaCustomProvider, PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import type { ProviderModelGroup } from '@/types/models/provider-model-group'
import listConfiguredProviders from '@/services/providers/list-configured-providers'
import {
  getProviderCatalogEntry,
  keychainKeyForProvider,
  providerRequiresApiKey,
} from '@/services/providers/registry'
import { getSecret } from '@/services/pyrola/pyrola-tauri'
import { listProviderModels } from '@/services/providers/list-provider-models'

const getCustomProvider = (
  settings: PyrolaSettings,
  providerId: string,
): PyrolaCustomProvider | undefined => {
  const customKey = `providers.custom.${providerId}` as const
  return settings[customKey] as PyrolaCustomProvider | undefined
}

const getApiKeyRef = (
  settings: PyrolaSettings,
  providerId: string,
): string | undefined => {
  const custom = getCustomProvider(settings, providerId)
  if (custom?.apiKeyRef) {
    return custom.apiKeyRef
  }
  const key = `providers.${providerId}.apiKeyRef` as const
  return settings[key]
}

const getProviderDisplayName = (
  settings: PyrolaSettings,
  providerId: string,
): string => {
  const custom = getCustomProvider(settings, providerId)
  if (custom?.name) {
    return custom.name
  }
  return getProviderCatalogEntry(providerId)?.name ?? providerId
}

const loadProviderModelGroup = async (
  settings: PyrolaSettings,
  providerId: string,
): Promise<ProviderModelGroup> => {
  const custom = getCustomProvider(settings, providerId)
  const catalogEntry = getProviderCatalogEntry(providerId)
  const requiresKey = custom ? false : providerRequiresApiKey(providerId)
  const providerName = getProviderDisplayName(settings, providerId)

  let apiKey = ''
  const apiKeyRef = getApiKeyRef(settings, providerId)
  if (apiKeyRef) {
    apiKey = (await getSecret(keychainKeyForProvider(apiKeyRef))) ?? ''
  }

  let modelIds: string[] = []

  try {
    if (requiresKey && !apiKey) {
      modelIds = catalogEntry?.models ?? []
    } else {
      modelIds = await listProviderModels({
        providerId: custom ? 'openai' : providerId,
        catalogProviderId: providerId,
        apiKey,
        baseUrl: custom?.baseURL ?? catalogEntry?.defaultBaseUrl,
      })
    }
  } catch {
    modelIds = catalogEntry?.models ?? []
  }

  return {
    providerId,
    providerName,
    models: modelIds.map((modelId) => ({ providerId, modelId })),
  }
}

export default async (settings: PyrolaSettings): Promise<ProviderModelGroup[]> => {
  const providerIds = listConfiguredProviders(settings)

  if (providerIds.length === 0) {
    return []
  }

  const results = await Promise.allSettled(
    providerIds.map((providerId) => loadProviderModelGroup(settings, providerId)),
  )

  return results
    .filter((result): result is PromiseFulfilledResult<ProviderModelGroup> => result.status === 'fulfilled')
    .map((result) => result.value)
    .sort((left, right) => left.providerName.localeCompare(right.providerName))
}
