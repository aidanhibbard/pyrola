<script setup lang="ts">
import { SidebarTrigger } from '@/components/shadcn/ui/sidebar'
import WindowControls from './WindowControls.vue'
import RightSidebarTrigger from '@/components/navigation/aside/right/RightSidebarTrigger.vue'
import ModeToggle from './ModeToggle.vue'
import useWorkbenchStore from '@/composables/use-workbench-store'

const workbench = useWorkbenchStore()
</script>

<template>
  <header
    class="pointer-events-none fixed inset-x-0 top-0 z-50 flex h-(--titlebar-height) shrink-0 items-center bg-none"
    style="--titlebar-height: 40px"
  >
    <WindowControls class="pointer-events-auto" />
    <SidebarTrigger class="pointer-events-auto ml-2" />
    <ModeToggle class="pointer-events-auto ml-1" />

    <!-- Draggable spacer (center + left; right panel uses WorkbenchHeader drag when open) -->
    <div class="pointer-events-auto h-full flex-1" data-tauri-drag-region />

    <div v-if="!workbench.rightSidebarOpen.value" class="pointer-events-auto mr-3">
      <RightSidebarTrigger />
    </div>
  </header>
</template>
