<script setup lang="ts">
import { useMagicKeys, whenever } from '@vueuse/core'
import AppSidebar from '@/components/navigation/aside/left/LeftSidebar.vue'
import NavigationCommandPalette from '@/components/navigation/CommandPalette.vue'
import { SidebarInset, SidebarProvider } from '@/components/shadcn/ui/sidebar'
import RightSidebarProvider from '@/components/navigation/aside/right/RightSidebarProvider.vue'
import RightSidebar from '@/components/navigation/aside/right/RightSidebar.vue'
import WorkbenchWorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchWorkbenchTabDuplicateDialog from '@/components/workbench/WorkbenchTabDuplicateDialog.vue'
import WorkbenchHeader from '@/components/workbench/WorkbenchHeader.vue'
import TitleBar from '@/components/navigation/header/TitleBar.vue'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/shadcn/ui/resizable'
import { Toaster } from '@/components/shadcn/ui/sonner'
import useAppearance from '@/composables/use-appearance'
import useCommandPalette from '@/composables/use-command-palette'
import usePyrolaLiveSync from '@/composables/use-pyrola-live-sync'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useWorkbenchStore from '@/composables/use-workbench-store'
import { RouterView } from 'vue-router'

useFleetRegistry()
useAppearance()
usePyrolaLiveSync()

const { rightSidebarOpen } = useWorkbenchStore()
const commandPalette = useCommandPalette()

const keys = useMagicKeys({
  passive: false,
  onEventFired(event) {
    if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
    }
  },
})

whenever(
  () => keys.Meta_K?.value || keys.Ctrl_K?.value,
  () => {
    commandPalette.togglePalette()
  },
)
</script>

<template>
  <SidebarProvider class="overflow-x-hidden">
    <AppSidebar />
    <SidebarInset class="min-w-0 w-0 flex-1 overflow-hidden">
      <RightSidebarProvider
        v-model:open="rightSidebarOpen"
        class="h-svh min-w-0 flex-1 overflow-hidden"
      >
        <TitleBar />
        <ResizablePanelGroup direction="horizontal" class="min-h-0 min-w-0 flex-1 overflow-hidden">
          <ResizablePanel :min-size="30" class="h-full min-h-0 min-w-0 overflow-hidden">
            <main
              class="flex h-full min-h-0 flex-col overflow-hidden pt-(--titlebar-height)"
              style="--titlebar-height: 40px"
            >
              <RouterView class="min-h-0 flex-1" />
            </main>
          </ResizablePanel>
          <ResizableHandle v-if="rightSidebarOpen" />
          <ResizablePanel
            v-if="rightSidebarOpen"
            :default-size="35"
            :min-size="20"
            :max-size="65"
            class="min-h-0 min-w-0 overflow-hidden"
          >
            <RightSidebar class="relative pt-(--titlebar-height)" style="--titlebar-height: 40px">
              <WorkbenchHeader />
              <WorkbenchWorkbenchShell />
            </RightSidebar>
          </ResizablePanel>
        </ResizablePanelGroup>
      </RightSidebarProvider>
    </SidebarInset>
    <Toaster />
    <NavigationCommandPalette />
    <WorkbenchWorkbenchTabDuplicateDialog />
  </SidebarProvider>
</template>
