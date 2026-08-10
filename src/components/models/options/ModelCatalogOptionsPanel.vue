<script setup lang="ts">
import { computed } from 'vue'
import { Label } from '@/components/shadcn/ui/label'
import { Switch } from '@/components/shadcn/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ModelCatalogOption } from '@/types/models/model-catalog-option'
import type { ReasoningLevel } from '@/types/models/reasoning-level'
import { REASONING_LEVEL_LABELS } from '@/types/models/reasoning-level'
import type { ReasoningCapability } from '@/services/models/resolve-reasoning-capability'

const props = withDefaults(
  defineProps<{
    option: ModelCatalogOption
    capability: ReasoningCapability
    supportsFast?: boolean
  }>(),
  {
    supportsFast: false,
  },
)

const emit = defineEmits<{
  change: [patch: ModelCatalogOption]
}>()

const allowed = computed(() => props.option.allowed !== false)
const fast = computed(() => props.option.fast === true)
const reasoning = computed(
  () => props.option.reasoning ?? 'provider-default',
)

const handleAllowed = (value: boolean): void => {
  emit('change', { allowed: value ? true : false })
}

const handleFast = (value: boolean): void => {
  emit('change', { fast: value })
}

const handleReasoning = (value: unknown): void => {
  if (typeof value !== 'string') {
    return
  }
  emit('change', {
    reasoning: value as ReasoningLevel,
  })
}
</script>

<template>
  <div
    class="space-y-3 p-1"
    @click.stop
    @pointerdown.stop
  >
    <div class="flex items-center justify-between gap-3">
      <Label class="text-xs font-normal">Allowed in chat</Label>
      <Switch :model-value="allowed" @update:model-value="handleAllowed" />
    </div>
    <div
      v-if="supportsFast"
      class="flex items-center justify-between gap-3"
    >
      <Label class="text-xs font-normal">Fast</Label>
      <Switch :model-value="fast" @update:model-value="handleFast" />
    </div>
    <div
      v-if="capability.supported"
      class="space-y-1.5"
    >
      <Label class="text-xs font-normal">Reasoning</Label>
      <Select :model-value="reasoning" @update:model-value="handleReasoning">
        <SelectTrigger size="sm" class="w-full">
          <SelectValue placeholder="Default" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="level in capability.levels"
            :key="level"
            :value="level"
          >
            {{ REASONING_LEVEL_LABELS[level] }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>
