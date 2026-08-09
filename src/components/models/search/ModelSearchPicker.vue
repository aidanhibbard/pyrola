<script setup lang="ts">
import { computed, ref } from 'vue'
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
import {
  getModelCatalogOption,
  isModelAllowed,
  mergeModelCatalogOption,
} from '@/services/models/model-catalog-options'
import resolveReasoningCapability from '@/services/models/resolve-reasoning-capability'

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
  if (!props.modelValue.trim()) {
    return []
  }
  return [props.modelValue]
})

const catalog = useProviderModelsCatalog({
  settings: settingsSource,
  extraModelRefs,
})

const modelDisplayName = (model: ModelRef): string =>
  model.name?.trim() || model.modelId.split('/').pop() || model.modelId

type NamedGroup = {
  name: string
  models: Array<ModelRef & { providerName: string }>
}

const filteredGroups = computed((): NamedGroup[] => {
  const providerGroups = catalog.filterGroups(searchQuery.value)
  const byName = new Map<string, NamedGroup>()

  for (const group of providerGroups) {
    for (const model of group.models) {
      if (
        props.hideDisallowed &&
        !isModelAllowed(settingsSource.value, model)
      ) {
        continue
      }
      const name = modelDisplayName(model)
      const existing = byName.get(name)
      const entry = { ...model, providerName: group.providerName }
      if (existing) {
        existing.models.push(entry)
      } else {
        byName.set(name, { name, models: [entry] })
      }
    }
  }

  return [...byName.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  )
})

const displayLabel = computed(() => {
  if (!props.modelValue) {
    return props.placeholder
  }
  return catalog.labelForSerialized(props.modelValue)
})

const compactLabel = computed(() => {
  if (!props.modelValue) {
    return props.placeholder
  }
  const parsed = parseModelRef(props.modelValue)
  if (!parsed) {
    const segments = props.modelValue.split('/')
    return segments[segments.length - 1] ?? props.modelValue
  }
  const segments = parsed.modelId.split('/')
  return segments[segments.length - 1] ?? parsed.modelId
})

const selectedSuffix = computed(() => {
  const parsed = parseModelRef(props.modelValue)
  if (!parsed) {
    return ''
  }
  const option = getModelCatalogOption(settingsSource.value, parsed)
  const bits: string[] = []
  if (option.reasoning && option.reasoning !== 'provider-default') {
    bits.push(option.reasoning)
  }
  if (option.fast) {
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
  await router.push({ path: '/settings', query: { tab: 'personal', section: 'providers' } })
}

const serializedFor = (model: ModelRef): string =>
  serializeModelRef({ providerId: model.providerId, modelId: model.modelId })

const optionFor = (model: ModelRef): ModelCatalogOption =>
  getModelCatalogOption(settingsSource.value, model)

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
  } catch (error) {
    toast.error('Failed to save model options', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
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
            ? 'h-8 w-auto max-w-none shrink-0 border-0 bg-transparent px-2 shadow-none hover:bg-transparent'
            : 'w-full max-w-md justify-between font-normal'
        "
        :title="displayLabel"
      >
        <span class="truncate text-sm">
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
          <ModelsSearchModelSelectorEmpty>Loading models…</ModelsSearchModelSelectorEmpty>
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
        <template v-else-if="filteredGroups.length === 0">
          <ModelsSearchModelSelectorEmpty>No models match your search.</ModelsSearchModelSelectorEmpty>
        </template>
        <template v-else>
          <ModelsSearchModelSelectorGroup
            v-for="group in filteredGroups"
            :key="group.name"
            :heading="group.name"
          >
            <ModelsSearchModelSelectorItem
              v-for="model in group.models"
              :key="serializedFor(model)"
              :value="serializedFor(model)"
              class="group/item"
              @select="handleSelect(model.providerId, model.modelId)"
            >
              <ModelsSearchModelSelectorLogo :provider="model.providerId" />
              <ModelsSearchModelSelectorName class="min-w-0 flex-1 truncate">
                {{ model.providerName }}
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
                    :title="`Options for ${group.name}`"
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
                    @change="handleOptionChange(model, $event)"
                  />
                </PopoverContent>
              </Popover>
            </ModelsSearchModelSelectorItem>
          </ModelsSearchModelSelectorGroup>
        </template>
      </ModelsSearchModelSelectorList>
    </ModelsSearchModelSelectorContent>
  </ModelsSearchModelSelector>
</template>
