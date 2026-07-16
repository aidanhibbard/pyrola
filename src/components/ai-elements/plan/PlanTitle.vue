<script setup lang="ts">
import { CardTitle } from '@/components/ui/card'
import { usePlan } from './context'

const { isStreaming } = usePlan()
</script>

<template>
  <CardTitle data-slot="plan-title" v-bind="$attrs">
    <span v-if="isStreaming" class="shimmer">
      <slot />
    </span>
    <slot v-else />
  </CardTitle>
</template>
