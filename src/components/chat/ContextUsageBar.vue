<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  used?: number
  limit?: number
}>()

const label = computed(() => {
  if (!props.limit) {
    return 'Context'
  }
  const pct = Math.round(((props.used ?? 0) / props.limit) * 100)
  return `Context ${pct}%`
})
</script>

<template>
  <div class="px-4 py-1 text-xs text-muted-foreground">
    {{ label }}
  </div>
</template>
