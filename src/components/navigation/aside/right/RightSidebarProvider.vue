<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { ref } from "vue"
import { cn } from "@/lib/utils"
import { provideRightSidebarContext, RIGHT_SIDEBAR_WIDTH } from "./utils"

const props = withDefaults(defineProps<{
  defaultOpen?: boolean
  class?: HTMLAttributes["class"]
}>(), {
  defaultOpen: false,
})

const open = ref(props.defaultOpen)

function setOpen(value: boolean) {
  open.value = value
}

function toggleSidebar() {
  open.value = !open.value
}

provideRightSidebarContext({
  open,
  setOpen,
  toggleSidebar,
})
</script>

<template>
  <div
    data-slot="right-sidebar-wrapper"
    :style="{
      '--right-sidebar-width': RIGHT_SIDEBAR_WIDTH,
    }"
    :class="cn('group/right-sidebar-wrapper flex min-h-svh w-full', props.class)"
  >
    <slot />
  </div>
</template>
