<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

interface Props extends /* @vue-ignore */ HTMLAttributes {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <div :class="cn('space-y-2', props.class)" v-bind="$attrs">
    <span class="font-medium text-muted-foreground text-xs uppercase tracking-wide">
      Dependencies
    </span>
    <div class="space-y-1">
      <slot />
    </div>
  </div>
</template>
