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
    :class="cn('flex shrink-0 items-center gap-1', props.class)"
    role="group"
    v-bind="$attrs"
    @click.stop
    @keydown.enter.stop
    @keydown.space.stop
  >
    <slot />
  </div>
</template>
