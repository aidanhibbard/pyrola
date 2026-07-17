<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  cols?: number | string
}>()

const gridClass = computed(() => {
  const cols = Number(props.cols ?? 2)
  if (cols <= 1) {
    return 'grid-cols-1'
  }
  if (cols >= 3) {
    return 'grid-cols-1 md:grid-cols-3'
  }
  return 'grid-cols-1 md:grid-cols-2'
})
</script>

<template>
  <div class="grid gap-4" :class="gridClass">
    <slot />
  </div>
</template>
