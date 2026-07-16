<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { toRef } from 'vue'
import { cn } from '@/lib/utils'
import { provideRightSidebarContext } from './utils'

const props = withDefaults(
  defineProps<{
    open: boolean
    class?: HTMLAttributes['class']
  }>(),
  {
    open: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const open = toRef(props, 'open')

const setOpen = (value: boolean) => emit('update:open', value)

const toggleSidebar = () => emit('update:open', !props.open)

provideRightSidebarContext({
  open,
  setOpen,
  toggleSidebar,
})
</script>

<template>
  <div
    data-slot="right-sidebar-wrapper"
    :class="cn('group/right-sidebar-wrapper flex min-h-svh w-full', props.class)"
  >
    <slot />
  </div>
</template>
