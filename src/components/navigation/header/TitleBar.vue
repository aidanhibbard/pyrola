<script setup lang="ts">
import { SidebarTrigger } from "@/components/shadcn/ui/sidebar"
import WindowControls from "./WindowControls.vue"
import RightSidebarTrigger from "@/components/navigation/aside/right/RightSidebarTrigger.vue"
import ModeToggle from "./ModeToggle.vue"
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-50 flex h-(--titlebar-height) shrink-0 items-center bg-none"
    style="--titlebar-height: 40px"
    data-tauri-drag-region
  >
    <WindowControls />
    <SidebarTrigger class="ml-2" />

    <!-- Draggable spacer -->
    <div class="h-full flex-1" data-tauri-drag-region />

    <ModeToggle class="mr-1" />
    <RightSidebarTrigger class="mr-3" />
  </header>
</template>
