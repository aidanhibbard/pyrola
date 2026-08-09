import type { ModelRef } from '@/types/models/model-ref'
import type { ReasoningLevel } from '@/types/models/reasoning-level'
import { isReasoningLevel } from '@/types/models/reasoning-level'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import type { ModelRoleId } from '@/data/model-role-registry'
import { MODEL_ROLE_REGISTRY } from '@/data/model-role-registry'
import {
  getCustomProvider,
  getProviderCatalogEntry,
} from '@/services/providers/registry'
import { getModelCatalogOption } from '@/services/models/model-catalog-options'

export type ReasoningCallMapping = {
  reasoning?: ReasoningLevel
  fast?: boolean
  providerOptionsReasoningEffort?: string
  providerOptionsKey?: string
}

const normalizeEffort = (
  value: string | ReasoningLevel | null | undefined,
): ReasoningLevel | undefined => {
  if (!value || !isReasoningLevel(value)) {
    return undefined
  }
  return value
}

export const resolveReasoningForRole = (
  role: ModelRoleId,
  settings: PyrolaSettings,
): ReasoningLevel | undefined => {
  const definition = MODEL_ROLE_REGISTRY.find((entry) => entry.id === role)
  if (!definition?.reasoningSettingsKey) {
    return undefined
  }
  const roleValue = normalizeEffort(settings[definition.reasoningSettingsKey])
  if (roleValue) {
    return roleValue
  }
  if (role === 'default') {
    return undefined
  }
  return normalizeEffort(settings['models.defaultReasoning'])
}

export const resolveCatalogReasoning = (
  settings: PyrolaSettings,
  ref: ModelRef,
): ReasoningLevel | undefined =>
  normalizeEffort(getModelCatalogOption(settings, ref).reasoning)

export const pickResolvedReasoning = (
  candidates: Array<string | ReasoningLevel | null | undefined>,
): ReasoningLevel | undefined => {
  for (const candidate of candidates) {
    const normalized = normalizeEffort(candidate)
    if (normalized) {
      return normalized
    }
  }
  return undefined
}

export const mapReasoningToCallOptions = (
  settings: PyrolaSettings,
  ref: ModelRef,
  reasoning: ReasoningLevel | undefined,
): ReasoningCallMapping => {
  const catalog = getModelCatalogOption(settings, ref)
  const customDefault = getCustomProvider(settings, ref.providerId)?.models?.find(
    (entry) => entry.id === ref.modelId,
  )?.reasoningEffort

  const effective =
    reasoning && reasoning !== 'provider-default'
      ? reasoning
      : normalizeEffort(catalog.reasoning) ?? normalizeEffort(customDefault)

  const mapping: ReasoningCallMapping = {
    fast: catalog.fast === true ? true : undefined,
  }

  if (!effective || effective === 'provider-default') {
    return mapping
  }

  if (
    ref.providerId === 'anthropic' ||
    ref.providerId === 'google' ||
    ref.providerId === 'gateway'
  ) {
    return { ...mapping, reasoning: effective }
  }

  if (getCustomProvider(settings, ref.providerId)) {
    return {
      ...mapping,
      reasoning: effective,
      providerOptionsKey: ref.providerId,
      providerOptionsReasoningEffort: effective,
    }
  }

  const catalogEntry = getProviderCatalogEntry(ref.providerId)
  if (catalogEntry || ref.providerId === 'openai') {
    return {
      ...mapping,
      reasoning: effective,
      providerOptionsKey: 'openai',
      providerOptionsReasoningEffort: effective,
    }
  }

  return {
    ...mapping,
    reasoning: effective,
    providerOptionsKey: ref.providerId,
    providerOptionsReasoningEffort: effective,
  }
}

export default mapReasoningToCallOptions
