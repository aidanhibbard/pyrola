<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"
import { useRightSidebar } from "./utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()

const { open } = useRightSidebar()
</script>

<template>
  <div
    data-slot="right-sidebar"
    :data-state="open ? 'expanded' : 'collapsed'"
    class="h-svh shrink-0 overflow-hidden border-l bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-linear"
    :class="cn(open ? 'w-(--right-sidebar-width)' : 'w-0', props.class)"
  >
    <div class="h-full w-(--right-sidebar-width)">
      <slot />
    </div>
  </div>
</template>
