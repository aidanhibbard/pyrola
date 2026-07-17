<script setup lang="ts">
import { computed } from 'vue'
import type { StudioUsageSegment } from '@/types/studio/studio-block-props'

const props = defineProps<{
  title?: string
  segments?: StudioUsageSegment[]
}>()

const items = computed(() => props.segments ?? [])
const total = computed(() => items.value.reduce((sum, item) => sum + item.value, 0))

const widthPercent = (value: number): string => {
  if (total.value <= 0) {
    return '0%'
  }
  return `${(value / total.value) * 100}%`
}
</script>

<template>
  <div v-if="items.length > 0" class="space-y-2">
    <h3 v-if="title" class="text-sm font-semibold">{{ title }}</h3>
    <div class="flex h-3 w-full overflow-hidden rounded-full bg-muted">
      <div
        v-for="(segment, index) in items"
        :key="`${segment.label}-${index}`"
        class="h-full"
        :style="{
          width: widthPercent(segment.value),
          backgroundColor: segment.color ?? `var(--chart-${(index % 5) + 1})`,
        }"
        :title="`${segment.label}: ${segment.value}`"
      />
    </div>
    <div class="flex flex-wrap gap-3 text-xs text-muted-foreground">
      <span v-for="(segment, index) in items" :key="`legend-${segment.label}-${index}`">
        {{ segment.label }} ({{ segment.value }})
      </span>
    </div>
  </div>
</template>
