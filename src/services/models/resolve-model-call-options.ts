import type { ModelRef } from '@/types/models/model-ref'
import type {
  PyrolaCustomProvider,
  PyrolaCustomProviderModel,
  PyrolaSettings,
} from '@/types/pyrola/pyrola-settings'
import { getCustomProvider } from '@/services/providers/registry'

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
type JsonObject = { [key: string]: JsonValue }

export type ResolvedModelCallOptions = {
  maxOutputTokens?: number
  temperature?: number
  topP?: number
  topK?: number
  frequencyPenalty?: number
  presencePenalty?: number
  seed?: number
  providerOptions?: Record<string, JsonObject>
}

export type ResolvedModelContextLimits = {
  maxInputTokens?: number
  maxOutputTokens?: number
}

const DEFAULT_MAX_OUTPUT_TOKENS = 8192
const DEFAULT_SIDE_TASK_MAX_OUTPUT_TOKENS = 256

export const getCustomProviderModel = (
  settings: PyrolaSettings,
  ref: ModelRef,
): { provider: PyrolaCustomProvider; model: PyrolaCustomProviderModel } | null => {
  const provider = getCustomProvider(settings, ref.providerId)
  if (!provider?.models?.length) {
    return null
  }
  const model = provider.models.find((entry) => entry.id === ref.modelId)
  if (!model) {
    return null
  }
  return { provider, model }
}

export const resolveContextWindow = (
  settings: PyrolaSettings,
  ref: ModelRef,
): number | undefined => {
  const matched = getCustomProviderModel(settings, ref)
  if (!matched) {
    return undefined
  }
  const { model } = matched
  if (typeof model.contextWindow === 'number' && model.contextWindow > 0) {
    return model.contextWindow
  }
  if (typeof model.maxInputTokens === 'number' && model.maxInputTokens > 0) {
    return model.maxInputTokens
  }
  return undefined
}

export const resolveMaxInputTokens = (
  settings: PyrolaSettings,
  ref: ModelRef,
): number | undefined => {
  const matched = getCustomProviderModel(settings, ref)
  if (!matched) {
    return undefined
  }
  const { model } = matched
  if (typeof model.maxInputTokens === 'number') {
    return model.maxInputTokens
  }
  if (typeof model.contextWindow === 'number') {
    const maxOutput = model.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
    const derived = model.contextWindow - maxOutput
    return derived > 0 ? derived : model.contextWindow
  }
  return undefined
}

export const resolveModelCallOptions = (
  settings: PyrolaSettings,
  ref: ModelRef,
  defaults?: { maxOutputTokens?: number },
): ResolvedModelCallOptions => {
  const fallbackMaxOutput = defaults?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
  const matched = getCustomProviderModel(settings, ref)

  if (!matched) {
    return { maxOutputTokens: fallbackMaxOutput }
  }

  const { model } = matched
  const options: ResolvedModelCallOptions = {
    maxOutputTokens: model.maxOutputTokens ?? fallbackMaxOutput,
  }

  if (typeof model.temperature === 'number') {
    options.temperature = model.temperature
  }
  if (typeof model.topP === 'number') {
    options.topP = model.topP
  }
  if (typeof model.topK === 'number') {
    options.topK = model.topK
  }
  if (typeof model.frequencyPenalty === 'number') {
    options.frequencyPenalty = model.frequencyPenalty
  }
  if (typeof model.presencePenalty === 'number') {
    options.presencePenalty = model.presencePenalty
  }
  if (typeof model.seed === 'number') {
    options.seed = model.seed
  }

  const providerOptionsBody: JsonObject = {}
  if (model.modelOptions) {
    for (const [key, value] of Object.entries(model.modelOptions)) {
      providerOptionsBody[key] = value as JsonValue
    }
  }
  if (model.reasoningEffort) {
    providerOptionsBody.reasoningEffort = model.reasoningEffort
  }

  if (Object.keys(providerOptionsBody).length > 0) {
    options.providerOptions = {
      [ref.providerId]: providerOptionsBody,
    }
  }

  return options
}

export const resolveSideTaskCallOptions = (
  settings: PyrolaSettings,
  ref: ModelRef,
): ResolvedModelCallOptions =>
  resolveModelCallOptions(settings, ref, {
    maxOutputTokens: DEFAULT_SIDE_TASK_MAX_OUTPUT_TOKENS,
  })

export { DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_SIDE_TASK_MAX_OUTPUT_TOKENS }
