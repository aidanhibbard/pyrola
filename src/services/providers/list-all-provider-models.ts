import type { PyrolaCustomProvider, PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import type { ProviderModelGroup } from '@/types/models/provider-model-group'
import type { ModelRef } from '@/types/models/model-ref'
import listConfiguredProviders from '@/services/providers/list-configured-providers'
import {
  getCustomProvider,
  getProviderCatalogEntry,
  keychainKeyForProvider,
  providerRequiresApiKey,
} from '@/services/providers/registry'
import { getSecret } from '@/services/pyrola/pyrola-tauri'
import { listProviderModels } from '@/services/providers/list-provider-models'

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

const configuredModelIds = (custom: PyrolaCustomProvider | undefined): string[] =>
  custom?.models?.map((model) => model.id).filter(Boolean) ?? []

const mergeModelIds = (configured: string[], live: string[]): string[] => {
  const seen = new Set<string>()
  const merged: string[] = []
  for (const id of [...configured, ...live]) {
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    merged.push(id)
  }
  return merged
}

const toModelRefs = (
  providerId: string,
  modelIds: string[],
  custom: PyrolaCustomProvider | undefined,
): ModelRef[] =>
  modelIds.map((modelId) => {
    const configured = custom?.models?.find((model) => model.id === modelId)
    return {
      providerId,
      modelId,
      ...(configured?.name ? { name: configured.name } : {}),
    }
  })

const loadProviderModelGroup = async (
  settings: PyrolaSettings,
  providerId: string,
): Promise<ProviderModelGroup> => {
  const custom = getCustomProvider(settings, providerId)
  const catalogEntry = getProviderCatalogEntry(providerId)
  const requiresKey = providerRequiresApiKey(providerId, settings)
  const providerName = getProviderDisplayName(settings, providerId)
  const configured = configuredModelIds(custom)

  let apiKey = ''
  const apiKeyRef = getApiKeyRef(settings, providerId)
  if (apiKeyRef) {
    apiKey = (await getSecret(keychainKeyForProvider(apiKeyRef))) ?? ''
  }

  let liveModelIds: string[] = []

  try {
    if (requiresKey && !apiKey) {
      liveModelIds = catalogEntry?.models ?? []
    } else {
      liveModelIds = await listProviderModels({
        providerId: custom ? 'openai' : providerId,
        catalogProviderId: providerId,
        apiKey,
        baseUrl: custom?.baseURL ?? catalogEntry?.defaultBaseUrl,
      })
    }
  } catch {
    liveModelIds = catalogEntry?.models ?? []
  }

  const modelIds =
    configured.length > 0
      ? mergeModelIds(configured, liveModelIds)
      : liveModelIds.length > 0
        ? liveModelIds
        : (catalogEntry?.models ?? [])

  return {
    providerId,
    providerName,
    models: toModelRefs(providerId, modelIds, custom),
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
