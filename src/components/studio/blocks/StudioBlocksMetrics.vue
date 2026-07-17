<script setup lang="ts">
import { computed } from 'vue'
import type { StudioMetricItem } from '@/types/studio/studio-block-props'

const props = defineProps<{
  items?: StudioMetricItem[]
}>()

const metrics = computed(() => props.items ?? [])

const deltaClass = (tone?: string): string => {
  if (tone === 'positive') {
    return 'text-emerald-600 dark:text-emerald-400'
  }
  if (tone === 'negative') {
    return 'text-destructive'
  }
  return 'text-muted-foreground'
}
</script>

<template>
  <div
    v-if="metrics.length > 0"
    class="grid divide-x divide-border/50 rounded-lg border border-border/40"
    :style="{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }"
  >
    <div v-for="(item, index) in metrics" :key="`${item.label}-${index}`" class="px-4 py-3">
      <p class="text-xs text-muted-foreground">{{ item.label }}</p>
      <div class="mt-1 flex items-baseline gap-1.5">
        <p class="text-xl font-semibold tracking-tight tabular-nums">{{ item.value }}</p>
        <p v-if="item.delta" class="text-xs font-medium" :class="deltaClass(item.tone)">
          {{ item.delta }}
        </p>
      </div>
    </div>
  </div>
</template>
