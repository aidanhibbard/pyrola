<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

interface Props extends /* @vue-ignore */ HTMLAttributes {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <p :class="cn('mt-2 text-muted-foreground text-sm', props.class)" v-bind="$attrs">
    <slot />
  </p>
</template>
