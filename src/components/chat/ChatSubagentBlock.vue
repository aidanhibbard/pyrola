<script setup lang="ts">
import { Marker, MarkerContent } from '@/components/shadcn/ui/marker'

defineProps<{
  agentName: string
  summary: string
  blocking?: boolean
}>()
</script>

<template>
  <Marker variant="border" class="w-full">
    <MarkerContent>
      Subagent {{ agentName }}<span v-if="blocking"> (blocking)</span>: {{ summary }}
    </MarkerContent>
  </Marker>
</template>
