<script setup lang="ts">
import { computed } from 'vue'
import { SidebarTrigger, useSidebar } from '@/components/shadcn/ui/sidebar'
import WindowControls from './WindowControls.vue'
import RightSidebarTrigger from '@/components/navigation/aside/right/RightSidebarTrigger.vue'
import ModeToggle from './ModeToggle.vue'
import ChatChatBreadcrumbs from '@/components/chat/ChatBreadcrumbs.vue'
import useWorkbenchStore from '@/composables/use-workbench-store'

const workbench = useWorkbenchStore()
const { open: leftSidebarOpen, isMobile } = useSidebar()

const leftChromeWidth = computed(() => {
  if (isMobile.value || !leftSidebarOpen.value) {
    return undefined
  }
  return 'var(--sidebar-width)'
})
</script>

<template>
  <header
    class="pointer-events-none fixed inset-x-0 top-0 z-50 flex h-(--titlebar-height) shrink-0 items-center bg-none"
    style="--titlebar-height: 40px"
  >
    <!--
      Left chrome stays a dedicated non-overlapping slot for traffic lights +
      toggles. Extra space inside the open sidebar is still draggable.
    -->
    <div
      class="pointer-events-auto flex h-full shrink-0 items-center"
      :style="leftChromeWidth ? { width: leftChromeWidth } : undefined"
    >
      <div
        class="flex h-full shrink-0 items-center"
        data-tauri-drag-region="false"
      >
        <WindowControls />
        <SidebarTrigger class="ml-2" />
        <ModeToggle class="ml-1" />
      </div>
      <div
        class="h-full min-w-0 flex-1"
        data-tauri-drag-region
      />
    </div>

    <div
      class="pointer-events-auto ml-3 min-w-0 shrink-0"
      data-tauri-drag-region="false"
    >
      <ChatChatBreadcrumbs class="min-w-0" />
    </div>

    <!-- Primary window drag surface across empty titlebar space -->
    <div
      class="pointer-events-auto h-full min-w-0 flex-1"
      data-tauri-drag-region
    />

    <div
      v-if="!workbench.rightSidebarOpen.value"
      class="pointer-events-auto relative z-[52] mr-3"
      data-tauri-drag-region="false"
    >
      <RightSidebarTrigger />
    </div>
  </header>
</template>
