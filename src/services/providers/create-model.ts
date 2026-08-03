import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createGateway } from '@ai-sdk/gateway'
import type { LanguageModel } from 'ai'
import type { PyrolaCustomProvider, PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import {
  getCustomProvider,
  getProviderCatalogEntry,
  keychainKeyForProvider,
} from '@/services/providers/registry'
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
  const custom = getCustomProvider(settings, providerId)
  const ref =
    custom?.apiKeyRef ??
    (settings[`providers.${providerId}.apiKeyRef` as keyof PyrolaSettings] as string | undefined)
  if (!ref) {
    return ''
  }
  return (await getSecret(keychainKeyForProvider(ref))) ?? ''
}

const mergeHeaders = (
  custom: PyrolaCustomProvider,
  modelId: string,
): Record<string, string> | undefined => {
  const modelHeaders = custom.models?.find((model) => model.id === modelId)?.headers
  if (!custom.headers && !modelHeaders) {
    return undefined
  }
  return {
    ...custom.headers,
    ...modelHeaders,
  }
}

export default async (input: CreateModelInput): Promise<LanguageModel> => {
  const { providerId, modelId, settings } = input
  const apiKey = await resolveApiKey(providerId, settings, input.apiKey)
  const custom = getCustomProvider(settings, providerId)
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

  if (custom) {
    return createOpenAICompatible({
      name: providerId,
      baseURL: custom.baseURL,
      apiKey: apiKey || undefined,
      headers: mergeHeaders(custom, modelId),
      queryParams: custom.queryParams,
      includeUsage: custom.includeUsage ?? true,
      supportsStructuredOutputs: custom.supportsStructuredOutputs,
      fetch,
    })(modelId)
  }

  const baseURL = catalog?.defaultBaseUrl
  const openai = createOpenAI({
    apiKey,
    baseURL,
    fetch,
  })
  return openai(modelId)
}
