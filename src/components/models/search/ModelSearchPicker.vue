<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronDownIcon } from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'
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
import usePyrolaConfig from '@/composables/use-pyrola-config'
import useProviderModelsCatalog from '@/composables/use-provider-models-catalog'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import serializeModelRef from '@/utils/serialize-model-ref'
import formatModelRefLabel from '@/utils/format-model-ref-label'
import parseModelRef from '@/utils/parse-model-ref'

const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    placeholder?: string
    compact?: boolean
    scopeSettings?: PyrolaSettings
  }>(),
  {
    disabled: false,
    placeholder: 'Select model',
    compact: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const router = useRouter()
const config = usePyrolaConfig()
const open = ref(false)
const searchQuery = ref('')

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

const filteredGroups = computed(() => catalog.filterGroups(searchQuery.value))

const displayLabel = computed(() => {
  if (!props.modelValue) {
    return props.placeholder
  }

  const parsed = parseModelRef(props.modelValue)
  if (!parsed) {
    return props.modelValue
  }

  return formatModelRefLabel(parsed)
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

const handleOpenChange = (nextOpen: boolean): void => {
  open.value = nextOpen
  if (!nextOpen) {
    searchQuery.value = ''
  }
}

const handleSelect = (providerId: string, modelId: string): void => {
  const serialized = serializeModelRef({ providerId, modelId })
  emit('update:modelValue', serialized)
  open.value = false
  searchQuery.value = ''
}

const openProvidersSettings = async (): Promise<void> => {
  open.value = false
  await router.push({ path: '/settings', query: { tab: 'personal', section: 'providers' } })
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
        </span>
        <ChevronDownIcon class="size-3.5 shrink-0 opacity-60" />
      </Button>
    </ModelsSearchModelSelectorTrigger>
    <ModelsSearchModelSelectorContent class="max-w-md">
      <ModelsSearchModelSelectorInput
        v-model="searchQuery"
        placeholder="Search providers or models…"
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
            :key="group.providerId"
            :heading="group.providerName"
          >
            <ModelsSearchModelSelectorItem
              v-for="model in group.models"
              :key="`${model.providerId}::${model.modelId}`"
              :value="catalog.serializedValueForModel(model.providerId, model.modelId)"
              @select="handleSelect(model.providerId, model.modelId)"
            >
              <ModelsSearchModelSelectorLogo :provider="model.providerId" />
              <ModelsSearchModelSelectorName>{{ model.modelId }}</ModelsSearchModelSelectorName>
            </ModelsSearchModelSelectorItem>
          </ModelsSearchModelSelectorGroup>
        </template>
      </ModelsSearchModelSelectorList>
    </ModelsSearchModelSelectorContent>
  </ModelsSearchModelSelector>
</template>
