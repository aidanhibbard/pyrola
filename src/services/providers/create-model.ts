import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createGateway } from '@ai-sdk/gateway'
import type { LanguageModel } from 'ai'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import { getProviderCatalogEntry, keychainKeyForProvider } from '@/services/providers/registry'
import { getSecret } from '@/services/pyrola/pyrola-tauri'
import proxyFetch from '@/services/providers/proxy-fetch'

export type CreateModelInput = {
  providerId: string
  modelId: string
  settings: PyrolaSettings
  apiKey?: string
}

const resolveApiKey = async (
  providerId: string,
  settings: PyrolaSettings,
  override?: string,
): Promise<string> => {
  if (override) {
    return override
  }
  const customKey = `providers.custom.${providerId}` as const
  const custom = settings[customKey] as { apiKeyRef?: string } | undefined
  const ref =
    custom?.apiKeyRef ??
    settings[`providers.${providerId}.apiKeyRef` as keyof PyrolaSettings] as string | undefined
  if (!ref) {
    return ''
  }
  return (await getSecret(keychainKeyForProvider(ref))) ?? ''
}

export default async (input: CreateModelInput): Promise<LanguageModel> => {
  const { providerId, modelId, settings } = input
  const apiKey = await resolveApiKey(providerId, settings, input.apiKey)
  const customKey = `providers.custom.${providerId}` as const
  const custom = settings[customKey] as { baseURL?: string } | undefined
  const catalog = getProviderCatalogEntry(providerId)
  const fetch = proxyFetch()

  if (providerId === 'anthropic') {
    return createAnthropic({ apiKey, fetch })(modelId)
  }
  if (providerId === 'google') {
    return createGoogleGenerativeAI({ apiKey, fetch })(modelId)
  }
  if (providerId === 'gateway') {
    return createGateway({ apiKey: apiKey || undefined, fetch })(modelId)
  }

  const baseURL = custom?.baseURL ?? catalog?.defaultBaseUrl
  const openai = createOpenAI({
    apiKey,
    baseURL,
    fetch,
  })
  return openai(modelId)
}
