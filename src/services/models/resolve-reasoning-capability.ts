import type { ModelRef } from '@/types/models/model-ref'
import type { ReasoningLevel } from '@/types/models/reasoning-level'
import { PORTABLE_REASONING_LEVELS, isReasoningLevel } from '@/types/models/reasoning-level'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import { getCustomProvider, getProviderCatalogEntry } from '@/services/providers/registry'

export type ReasoningCapability = {
  supported: boolean
  levels: ReasoningLevel[]
  mandatory: boolean
}

/** Providers where the AI SDK / router maps portable effort levels reliably. */
const PORTABLE_REASONING_PROVIDER_IDS = new Set([
  'anthropic',
  'google',
  'gateway',
  'openai',
  'openrouter',
])

const uniqueLevels = (levels: ReasoningLevel[]): ReasoningLevel[] => {
  const seen = new Set<ReasoningLevel>()
  const next: ReasoningLevel[] = []
  for (const level of levels) {
    if (seen.has(level)) {
      continue
    }
    seen.add(level)
    next.push(level)
  }
  return next
}

const levelsFromCustomList = (values: string[]): ReasoningLevel[] => {
  const parsed = values.filter(isReasoningLevel)
  if (parsed.length === 0) {
    return []
  }
  if (!parsed.includes('provider-default')) {
    return uniqueLevels(['provider-default', ...parsed])
  }
  return uniqueLevels(parsed)
}

export const resolveReasoningCapability = (
  settings: PyrolaSettings,
  ref: ModelRef | null | undefined,
): ReasoningCapability => {
  if (!ref) {
    return { supported: false, levels: [], mandatory: false }
  }

  const customProvider = getCustomProvider(settings, ref.providerId)
  if (customProvider) {
    const model = customProvider.models?.find((entry) => entry.id === ref.modelId)
    if (!model?.supportsReasoningEffort?.length) {
      // thinking alone means local thinking tokens, not portable effort levels
      return { supported: false, levels: [], mandatory: false }
    }
    const levels = levelsFromCustomList(model.supportsReasoningEffort)
    if (levels.length === 0) {
      return { supported: false, levels: [], mandatory: false }
    }
    return { supported: true, levels, mandatory: false }
  }

  if (PORTABLE_REASONING_PROVIDER_IDS.has(ref.providerId)) {
    return {
      supported: true,
      levels: PORTABLE_REASONING_LEVELS,
      mandatory: false,
    }
  }

  const catalog = getProviderCatalogEntry(ref.providerId)
  if (catalog?.category === 'ai-sdk' && PORTABLE_REASONING_PROVIDER_IDS.has(ref.providerId)) {
    return {
      supported: true,
      levels: PORTABLE_REASONING_LEVELS,
      mandatory: false,
    }
  }

  return { supported: false, levels: [], mandatory: false }
}

export default resolveReasoningCapability
