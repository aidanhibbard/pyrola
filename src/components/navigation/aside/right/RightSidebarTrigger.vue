<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { PanelRight } from "@lucide/vue"
import { cn } from "@/lib/utils"
import { Button } from "@/components/shadcn/ui/button"
import { useRightSidebar } from "./utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()

const { toggleSidebar } = useRightSidebar()
</script>

<template>
  <Button
    data-slot="right-sidebar-trigger"
    variant="ghost"
    size="icon"
    :class="cn('h-7 w-7', props.class)"
    @click="toggleSidebar"
  >
    <PanelRight />
    <span class="sr-only">Toggle Right Sidebar</span>
  </Button>
</template>
