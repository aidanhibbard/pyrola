import { httpProxyRequest } from '@/services/pyrola/pyrola-tauri'
import { getProviderCatalogEntry } from '@/services/providers/registry'
import {
  resolveModelsListRequest,
  type ProviderRequestContext,
} from '@/services/providers/provider-http'

const parseModelsFromResponse = (providerId: string, body: string): string[] => {
  const parsed = JSON.parse(body) as {
    data?: Array<{ id?: string }>
    models?: Array<{ name?: string; id?: string }>
  }

  if (providerId === 'google') {
    return (parsed.models ?? [])
      .map((model) => (model.name ?? '').replace(/^models\//, ''))
      .filter((model) => model.length > 0)
  }

  if (Array.isArray(parsed.data)) {
    return parsed.data.map((model) => model.id ?? '').filter((model) => model.length > 0)
  }

  if (Array.isArray(parsed.models)) {
    return parsed.models
      .map((model) => model.id ?? model.name ?? '')
      .filter((model) => model.length > 0)
  }

  return []
}

const catalogFallbackModels = (providerId: string): string[] =>
  getProviderCatalogEntry(providerId)?.models ?? []

export const listProviderModels = async (
  input: ProviderRequestContext,
): Promise<string[]> => {
  const request = resolveModelsListRequest(input)
  const result = await httpProxyRequest({
    url: request.url,
    method: 'GET',
    headers: request.headers,
  })

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Model listing failed with status ${result.status}`)
  }

  const models = [...new Set(parseModelsFromResponse(input.providerId, result.body))].sort(
    (left, right) => left.localeCompare(right),
  )

  if (models.length > 0) {
    return models
  }

  return catalogFallbackModels(input.catalogProviderId ?? input.providerId)
}
