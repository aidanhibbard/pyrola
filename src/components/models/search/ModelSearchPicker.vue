<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronDownIcon, Settings2Icon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/shadcn/ui/popover'
import ModelsSearchModelSelector from '@/components/ai-elements/model-selector/ModelSelector.vue'
import ModelsSearchModelSelectorContent from '@/components/ai-elements/model-selector/ModelSelectorContent.vue'
import ModelsSearchModelSelectorTrigger from '@/components/ai-elements/model-selector/ModelSelectorTrigger.vue'
import ModelsSearchModelSelectorInput from '@/components/ai-elements/model-selector/ModelSelectorInput.vue'
import ModelsSearchModelSelectorList from '@/components/ai-elements/model-selector/ModelSelectorList.vue'
import ModelsSearchModelSelectorGroup from '@/components/ai-elements/model-selector/ModelSelectorGroup.vue'
import ModelsSearchModelSelectorItem from '@/components/ai-elements/model-selector/ModelSelectorItem.vue'
import ModelsSearchModelSelectorEmpty from '@/components/ai-elements/model-selector/ModelSelectorEmpty.vue'
import ModelsSearchModelSelectorLogo from '@/components/ai-elements/model-selector/ModelSelectorLogo.vue'
import ModelsSearchModelSelectorName from '@/components/ai-elements/model-selector/ModelSelectorName.vue'
import ModelsOptionsModelCatalogOptionsPanel from '@/components/models/options/ModelCatalogOptionsPanel.vue'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import useProviderModelsCatalog from '@/composables/use-provider-models-catalog'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import type { ModelCatalogOption } from '@/types/models/model-catalog-option'
import type { ModelRef } from '@/types/models/model-ref'
import type { SettingsTab } from '@/composables/use-pyrola-config'
import serializeModelRef from '@/utils/serialize-model-ref'
import parseModelRef from '@/utils/parse-model-ref'
import humanizeModelId from '@/utils/humanize-model-id'
import {
  modelShortId,
  modelVendorId,
  modelVendorLabel,
} from '@/utils/model-vendor'
import {
  getClampedModelCatalogOption,
  getModelCatalogOption,
  isModelAllowed,
  mergeModelCatalogOption,
} from '@/services/models/model-catalog-options'
import clampModelCatalogOption from '@/services/models/clamp-model-catalog-option'
import resolveReasoningCapability from '@/services/models/resolve-reasoning-capability'
import resolveSupportsFast from '@/services/models/resolve-fast-capability'
import {
  canonicalizeModelRef,
} from '@/services/models/resolve-model-ref-for-call'
import { isFastModelId } from '@/services/models/parse-model-variant'

const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    placeholder?: string
    compact?: boolean
    scopeSettings?: PyrolaSettings
    /** Hide models marked allowed:false (chat pickers). */
    hideDisallowed?: boolean
    /** Persist catalog option edits to this settings scope. */
    optionsTab?: SettingsTab
  }>(),
  {
    disabled: false,
    placeholder: 'Select model',
    compact: false,
    hideDisallowed: false,
    optionsTab: 'personal',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const router = useRouter()
const config = usePyrolaConfig()
const open = ref(false)
const searchQuery = ref('')
const optionsOpenFor = ref<string | null>(null)

const settingsSource = computed(
  () => props.scopeSettings ?? config.effectiveSettings.value,
)

const extraModelRefs = computed(() => {
  const parsed = parseModelRef(props.modelValue)
  if (!parsed) {
    return props.modelValue.trim() ? [props.modelValue] : []
  }
  const canonical = canonicalizeModelRef(parsed)
  const serialized = serializeModelRef(canonical)
  return serialized === props.modelValue ? [props.modelValue] : [serialized, props.modelValue]
})

const catalog = useProviderModelsCatalog({
  settings: settingsSource,
  extraModelRefs,
})

const modelDisplayName = (model: ModelRef): string =>
  humanizeModelId(modelShortId(model.modelId))

type VendorGroup = {
  vendorId: string
  name: string
  models: Array<ModelRef & { providerName: string; label: string }>
}

const filteredGroups = computed((): VendorGroup[] => {
  const providerGroups = catalog.filterGroups(searchQuery.value)
  const byVendor = new Map<string, VendorGroup>()

  for (const group of providerGroups) {
    for (const model of group.models) {
      if (
        props.hideDisallowed &&
        !isModelAllowed(settingsSource.value, model)
      ) {
        continue
      }
      const vendorId = modelVendorId(model.modelId)
      const existing = byVendor.get(vendorId)
      const entry = {
        ...model,
        providerName: group.providerName,
        label: modelDisplayName(model),
      }
      if (existing) {
        existing.models.push(entry)
      } else {
        byVendor.set(vendorId, {
          vendorId,
          name: modelVendorLabel(model.modelId),
          models: [entry],
        })
      }
    }
  }

  const groups = [...byVendor.values()]
  for (const group of groups) {
    group.models.sort((left, right) => {
      const byLabel = left.label.localeCompare(right.label)
      if (byLabel !== 0) {
        return byLabel
      }
      return left.providerName.localeCompare(right.providerName)
    })
  }

  return groups.sort((left, right) => left.name.localeCompare(right.name))
})

type DisabledEntry = ModelRef & { providerName: string; label: string }

const disabledEntries = computed((): DisabledEntry[] => {
  if (!props.hideDisallowed) {
    return []
  }
  const providerGroups = catalog.filterGroups(searchQuery.value)
  const entries: DisabledEntry[] = []
  for (const group of providerGroups) {
    for (const model of group.models) {
      if (!isModelAllowed(settingsSource.value, model)) {
        entries.push({
          ...model,
          providerName: group.providerName,
          label: modelDisplayName(model),
        })
      }
    }
  }
  return entries.sort((left, right) => {
    const byLabel = left.label.localeCompare(right.label)
    if (byLabel !== 0) {
      return byLabel
    }
    return left.providerName.localeCompare(right.providerName)
  })
})

const canonicalSelection = computed(() => {
  const parsed = parseModelRef(props.modelValue)
  if (!parsed) {
    return null
  }
  return canonicalizeModelRef(parsed)
})

const displayLabel = computed(() => {
  if (!props.modelValue) {
    return props.placeholder
  }
  const canonical = canonicalSelection.value
  if (!canonical) {
    return catalog.labelForSerialized(props.modelValue)
  }
  return catalog.labelForSerialized(serializeModelRef(canonical))
})

const compactLabel = computed(() => {
  if (!props.modelValue) {
    return props.placeholder
  }
  const canonical = canonicalSelection.value
  if (!canonical) {
    const segments = props.modelValue.split('/')
    return segments[segments.length - 1] ?? props.modelValue
  }
  return humanizeModelId(canonical.modelId)
})

const selectedSuffix = computed(() => {
  const canonical = canonicalSelection.value
  if (!canonical) {
    return ''
  }
  const option = getClampedModelCatalogOption(settingsSource.value, canonical)
  const bits: string[] = []
  if (option.reasoning && option.reasoning !== 'provider-default') {
    bits.push(option.reasoning)
  }
  if (
    option.fast === true ||
    isFastModelId(parseModelRef(props.modelValue)?.modelId ?? '')
  ) {
    bits.push('fast')
  }
  return bits.length > 0 ? bits.join(', ') : ''
})

const handleOpenChange = (nextOpen: boolean): void => {
  open.value = nextOpen
  if (!nextOpen) {
    searchQuery.value = ''
    optionsOpenFor.value = null
  }
}

const handleSelect = (providerId: string, modelId: string): void => {
  const serialized = serializeModelRef({ providerId, modelId })
  emit('update:modelValue', serialized)
  open.value = false
  searchQuery.value = ''
  optionsOpenFor.value = null
}

const openProvidersSettings = async (): Promise<void> => {
  open.value = false
  await router.push({ path: '/settings', query: { section: 'providers' } })
}

const serializedFor = (model: ModelRef): string =>
  serializeModelRef({ providerId: model.providerId, modelId: model.modelId })

const optionFor = (model: ModelRef): ModelCatalogOption => {
  const option = getModelCatalogOption(settingsSource.value, model)
  const selected = canonicalSelection.value
  let next = option
  if (
    selected &&
    selected.providerId === model.providerId &&
    selected.modelId === model.modelId &&
    isFastModelId(parseModelRef(props.modelValue)?.modelId ?? '')
  ) {
    next = { ...option, fast: true }
  }
  return clampModelCatalogOption(settingsSource.value, model, next)
}

const capabilityFor = (model: ModelRef) =>
  resolveReasoningCapability(settingsSource.value, model)

const openModelOptions = (serialized: string, next: boolean): void => {
  optionsOpenFor.value = next ? serialized : null
}

const handleOptionChange = async (
  model: ModelRef,
  patch: ModelCatalogOption,
): Promise<void> => {
  const nextMap = mergeModelCatalogOption(settingsSource.value, model, patch)
  try {
    await config.updateSetting(props.optionsTab, 'models.catalogOptions', nextMap)
    if (
      patch.fast !== undefined &&
      canonicalSelection.value &&
      canonicalSelection.value.providerId === model.providerId &&
      canonicalSelection.value.modelId === model.modelId &&
      isFastModelId(parseModelRef(props.modelValue)?.modelId ?? '')
    ) {
      emit('update:modelValue', serializeModelRef(model))
    }
  } catch (error) {
    toast.error('Failed to save model options', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

watch(
  () => [props.modelValue, catalog.loading.value] as const,
  async ([value, loading]) => {
    if (loading || !value.trim()) {
      return
    }
    const parsed = parseModelRef(value)
    if (!parsed || !isFastModelId(parsed.modelId)) {
      return
    }
    const canonical = canonicalizeModelRef(parsed)
    const nextSerialized = serializeModelRef(canonical)
    if (nextSerialized === value) {
      return
    }
    const nextMap = mergeModelCatalogOption(settingsSource.value, canonical, {
      ...getModelCatalogOption(settingsSource.value, parsed),
      ...getModelCatalogOption(settingsSource.value, canonical),
      fast: true,
    })
    try {
      await config.updateSetting(props.optionsTab, 'models.catalogOptions', nextMap)
      emit('update:modelValue', nextSerialized)
    } catch (error) {
      toast.error('Failed to normalize model selection', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },
  { immediate: true },
)
</script>

<template>
  <ModelsSearchModelSelector :open="open" @update:open="handleOpenChange">
    <ModelsSearchModelSelectorTrigger as-child>
      <Button
        type="button"
        :variant="compact ? 'ghost' : 'outline'"
        :size="compact ? 'sm' : 'default'"
        :disabled="disabled || catalog.loading.value"
        :class="
          compact
            ? 'h-8 min-w-0 max-w-56 border-0 bg-transparent px-2 shadow-none hover:bg-transparent'
            : 'w-full max-w-md justify-between font-normal'
        "
        :title="displayLabel"
      >
        <span class="min-w-0 truncate text-sm @max-[22rem]/composer:hidden">
          {{ compact ? compactLabel : displayLabel }}
          <span
            v-if="selectedSuffix"
            class="text-muted-foreground"
          >
            ({{ selectedSuffix }})
          </span>
        </span>
        <ChevronDownIcon class="size-3.5 shrink-0 opacity-60" />
      </Button>
    </ModelsSearchModelSelectorTrigger>
    <ModelsSearchModelSelectorContent class="max-w-md">
      <ModelsSearchModelSelectorInput
        v-model="searchQuery"
        placeholder="Search models..."
      />
      <ModelsSearchModelSelectorList>
        <template v-if="catalog.loading.value">
          <ModelsSearchModelSelectorEmpty>Loading models...</ModelsSearchModelSelectorEmpty>
        </template>
        <template v-else-if="!catalog.hasProviders.value">
          <ModelsSearchModelSelectorEmpty>
            <div class="space-y-2 text-center">
              <p>No providers configured.</p>
              <Button variant="outline" size="sm" @click="openProvidersSettings">
                Add a provider
              </Button>
            </div>
          </ModelsSearchModelSelectorEmpty>
        </template>
        <template v-else-if="filteredGroups.length === 0 && disabledEntries.length === 0">
          <ModelsSearchModelSelectorEmpty>No models match your search.</ModelsSearchModelSelectorEmpty>
        </template>
        <template v-else>
          <ModelsSearchModelSelectorGroup
            v-for="group in filteredGroups"
            :key="group.vendorId"
            :heading="group.name"
          >
            <ModelsSearchModelSelectorItem
              v-for="model in group.models"
              :key="serializedFor(model)"
              :value="`${serializedFor(model)} ${model.modelId} ${model.label} ${model.providerName} ${group.name}`"
              class="group/item"
              @select="handleSelect(model.providerId, model.modelId)"
            >
              <span class="sr-only">
                {{ model.modelId }} {{ group.name }}
              </span>
              <ModelsSearchModelSelectorLogo :provider="model.providerId" />
              <ModelsSearchModelSelectorName class="min-w-0 flex-1 truncate">
                <span class="truncate">{{ model.label }}</span>
                <span class="ml-1.5 text-xs font-normal text-muted-foreground">
                  {{ model.providerName }}
                </span>
                <span
                  v-if="optionFor(model).allowed === false"
                  class="ml-1 text-xs text-muted-foreground"
                >
                  (disabled)
                </span>
              </ModelsSearchModelSelectorName>
              <Popover
                :open="optionsOpenFor === serializedFor(model)"
                @update:open="openModelOptions(serializedFor(model), $event)"
              >
                <PopoverTrigger as-child>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7 shrink-0"
                    :title="`Options for ${model.label}`"
                    @click.stop
                    @pointerdown.stop
                  >
                    <Settings2Icon class="size-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  class="w-56"
                  align="end"
                  :side-offset="6"
                  @click.stop
                  @pointerdown.stop
                >
                  <ModelsOptionsModelCatalogOptionsPanel
                    :option="optionFor(model)"
                    :capability="capabilityFor(model)"
                    :supports-fast="resolveSupportsFast(model)"
                    @change="handleOptionChange(model, $event)"
                  />
                </PopoverContent>
              </Popover>
            </ModelsSearchModelSelectorItem>
          </ModelsSearchModelSelectorGroup>
          <div
            v-if="disabledEntries.length > 0"
            class="pt-2"
          >
            <p class="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Disabled
            </p>
            <div
              v-for="model in disabledEntries"
              :key="`disabled-${serializedFor(model)}`"
              class="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm opacity-60"
            >
              <ModelsSearchModelSelectorLogo :provider="model.providerId" />
              <ModelsSearchModelSelectorName class="min-w-0 flex-1 truncate">
                <span class="truncate">{{ model.label }}</span>
                <span class="ml-1.5 text-xs font-normal text-muted-foreground">
                  {{ model.providerName }}
                </span>
              </ModelsSearchModelSelectorName>
              <Popover
                :open="optionsOpenFor === serializedFor(model)"
                @update:open="openModelOptions(serializedFor(model), $event)"
              >
                <PopoverTrigger as-child>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7 shrink-0"
                    :title="`Re-enable ${model.label}`"
                    @click.stop
                    @pointerdown.stop
                  >
                    <Settings2Icon class="size-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  class="w-56"
                  align="end"
                  :side-offset="6"
                  @click.stop
                  @pointerdown.stop
                >
                  <ModelsOptionsModelCatalogOptionsPanel
                    :option="optionFor(model)"
                    :capability="capabilityFor(model)"
                    :supports-fast="resolveSupportsFast(model)"
                    @change="handleOptionChange(model, $event)"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </template>
      </ModelsSearchModelSelectorList>
    </ModelsSearchModelSelectorContent>
  </ModelsSearchModelSelector>
</template>
