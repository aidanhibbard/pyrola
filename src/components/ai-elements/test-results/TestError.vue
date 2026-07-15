<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

interface Props extends /* @vue-ignore */ HTMLAttributes {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <div
    :class="cn('mt-2 rounded-md bg-red-50 p-3 dark:bg-red-900/20', props.class)"
    v-bind="$attrs"
  >
    <slot />
  </div>
</template>
