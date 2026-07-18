import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import type { ProviderModelGroup } from '@/types/models/provider-model-group'
import listAllProviderModels from '@/services/providers/list-all-provider-models'
import serializeModelRef from '@/utils/serialize-model-ref'
import formatModelRefLabel from '@/utils/format-model-ref-label'

export type UseProviderModelsCatalogOptions = {
  settings: Ref<PyrolaSettings> | ComputedRef<PyrolaSettings>
  extraModelRefs?: Ref<string[]> | ComputedRef<string[]>
}

const mergeExtraModels = (
  groups: ProviderModelGroup[],
  extraRefs: string[],
): ProviderModelGroup[] => {
  if (extraRefs.length === 0) {
    return groups
  }

  const next = groups.map((group) => ({
    ...group,
    models: [...group.models],
  }))
  const groupByProvider = new Map(next.map((group) => [group.providerId, group]))

  for (const serialized of extraRefs) {
    const separatorIndex = serialized.indexOf('::')
    if (separatorIndex <= 0) {
      continue
    }
    const providerId = serialized.slice(0, separatorIndex)
    const modelId = serialized.slice(separatorIndex + 2)
    if (!providerId || !modelId) {
      continue
    }

    const existing = groupByProvider.get(providerId)
    const modelRef = { providerId, modelId }
    if (existing) {
      const alreadyPresent = existing.models.some(
        (model) => model.providerId === providerId && model.modelId === modelId,
      )
      if (!alreadyPresent) {
        existing.models.unshift(modelRef)
      }
      continue
    }

    const created: ProviderModelGroup = {
      providerId,
      providerName: providerId,
      models: [modelRef],
    }
    next.push(created)
    groupByProvider.set(providerId, created)
  }

  return next.sort((left, right) => left.providerName.localeCompare(right.providerName))
}

export default (options: UseProviderModelsCatalogOptions) => {
  const groups = ref<ProviderModelGroup[]>([])
  const loading = ref(false)
  let loadGeneration = 0

  const settingsFingerprint = computed(() => {
    const settings = options.settings.value
    const providerKeys = Object.keys(settings)
      .filter(
        (key) =>
          (key.startsWith('providers.') && key.endsWith('.apiKeyRef')) ||
          key.startsWith('providers.custom.'),
      )
      .sort()
      .join('|')
    return providerKeys
  })

  const refresh = async (): Promise<void> => {
    const generation = ++loadGeneration
    loading.value = true

    try {
      const loaded = await listAllProviderModels(options.settings.value)
      if (generation !== loadGeneration) {
        return
      }
      const extra = options.extraModelRefs?.value ?? []
      groups.value = mergeExtraModels(loaded, extra)
    } finally {
      if (generation === loadGeneration) {
        loading.value = false
      }
    }
  }

  const filterGroups = (query: string): ProviderModelGroup[] => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return groups.value
    }

    return groups.value
      .map((group) => {
        const providerMatches =
          group.providerName.toLowerCase().includes(normalized) ||
          group.providerId.toLowerCase().includes(normalized)

        const matchingModels = group.models.filter((model) =>
          model.modelId.toLowerCase().includes(normalized),
        )

        if (providerMatches) {
          return group
        }

        if (matchingModels.length === 0) {
          return null
        }

        return {
          ...group,
          models: matchingModels,
        }
      })
      .filter((group): group is ProviderModelGroup => group !== null)
  }

  const hasProviders = computed(() => groups.value.length > 0)

  const labelForSerialized = (serialized: string): string => {
    const separatorIndex = serialized.indexOf('::')
    if (separatorIndex <= 0) {
      return serialized
    }
    const providerId = serialized.slice(0, separatorIndex)
    const modelId = serialized.slice(separatorIndex + 2)
    return formatModelRefLabel({ providerId, modelId })
  }

  const serializedValueForModel = (providerId: string, modelId: string): string =>
    serializeModelRef({ providerId, modelId })

  watch(
    [settingsFingerprint, () => options.extraModelRefs?.value],
    () => {
      refresh().catch(() => {
        groups.value = []
        loading.value = false
      })
    },
    { immediate: true, deep: true },
  )

  return {
    groups,
    loading,
    hasProviders,
    refresh,
    filterGroups,
    labelForSerialized,
    serializedValueForModel,
  }
}
