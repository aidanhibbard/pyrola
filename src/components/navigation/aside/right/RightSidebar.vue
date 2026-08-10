<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
import { useRightSidebar } from './utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const { open } = useRightSidebar()
</script>

<template>
  <div
    data-slot="right-sidebar"
    :data-state="open ? 'expanded' : 'collapsed'"
    class="flex h-full w-full flex-col overflow-hidden border-l text-sidebar-foreground"
    :class="cn(props.class)"
  >
    <slot />
  </div>
</template>
