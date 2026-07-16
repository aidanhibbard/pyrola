import { getProviderCatalogEntry } from '@/services/providers/registry'

export type ProviderRequestContext = {
  providerId: string
  apiKey: string
  baseUrl?: string
  catalogProviderId?: string
}

export type ProviderHttpRequest = {
  url: string
  headers: Record<string, string>
}

export const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/$/, '')

export const joinUrl = (base: string, path: string): string => {
  const normalized = normalizeBaseUrl(base)
  return path.startsWith('/') ? `${normalized}${path}` : `${normalized}/${path}`
}

export const bearerAuth = (apiKey: string): Record<string, string> => ({
  Authorization: `Bearer ${apiKey}`,
})

export const resolveModelsListRequest = (
  input: ProviderRequestContext,
): ProviderHttpRequest => {
  const entry = getProviderCatalogEntry(input.providerId)
  const { apiKey } = input

  if (input.providerId === 'gateway') {
    const headers: Record<string, string> = {}
    if (apiKey) {
      Object.assign(headers, bearerAuth(apiKey))
    }
    return {
      url: 'https://ai-gateway.vercel.sh/v1/models',
      headers,
    }
  }

  if (input.providerId === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/models',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    }
  }

  if (input.providerId === 'google') {
    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/models',
      headers: {
        'x-goog-api-key': apiKey,
      },
    }
  }

  const baseURL =
    input.baseUrl ??
    entry?.defaultBaseUrl ??
    (input.providerId === 'openai' ? 'https://api.openai.com/v1' : undefined)

  if (baseURL) {
    const headers: Record<string, string> = {}
    if (apiKey) {
      Object.assign(headers, bearerAuth(apiKey))
    }
    return {
      url: joinUrl(baseURL, 'models'),
      headers,
    }
  }

  throw new Error(
    `Model listing is not configured for ${entry?.name ?? input.providerId} yet.`,
  )
}
