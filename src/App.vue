<script setup lang="ts">
import { ref } from 'vue'
import AppSidebar from '@/components/navigation/aside/left/LeftSidebar.vue'
import { SidebarInset, SidebarProvider } from '@/components/shadcn/ui/sidebar'
import RightSidebarProvider from '@/components/navigation/aside/right/RightSidebarProvider.vue'
import RightSidebar from '@/components/navigation/aside/right/RightSidebar.vue'
import WorkbenchWorkbenchPanel from '@/components/workbench/WorkbenchPanel.vue'
import TerminalTerminalPanel from '@/components/terminal/TerminalPanel.vue'
import TitleBar from '@/components/navigation/header/TitleBar.vue'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/shadcn/ui/resizable'
import { Toaster } from '@/components/shadcn/ui/sonner'
import useAppearance from '@/composables/use-appearance'
import usePyrolaLiveSync from '@/composables/use-pyrola-live-sync'
import useFleetRegistry from '@/composables/use-fleet-registry'
import { RouterView } from 'vue-router'

useFleetRegistry()
useAppearance()
usePyrolaLiveSync()

const rightSidebarOpen = ref(false)
const terminalOpen = ref(false)
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
            <ResizablePanelGroup direction="vertical" class="h-full min-h-0 overflow-hidden">
              <ResizablePanel :min-size="40" class="min-h-0 overflow-hidden">
                <main
                  class="flex h-full min-h-0 flex-col overflow-hidden pt-(--titlebar-height)"
                  style="--titlebar-height: 40px"
                >
                  <RouterView class="min-h-0 flex-1" />
                </main>
              </ResizablePanel>
              <ResizableHandle v-if="terminalOpen" />
              <ResizablePanel v-if="terminalOpen" :default-size="25" :min-size="15" :max-size="50">
                <TerminalTerminalPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle v-if="rightSidebarOpen" />
          <ResizablePanel
            v-if="rightSidebarOpen"
            :default-size="35"
            :min-size="20"
            :max-size="55"
            class="min-h-0 min-w-0 overflow-hidden"
          >
            <RightSidebar class="pt-(--titlebar-height)" style="--titlebar-height: 40px">
              <WorkbenchWorkbenchPanel />
            </RightSidebar>
          </ResizablePanel>
        </ResizablePanelGroup>
      </RightSidebarProvider>
    </SidebarInset>
    <Toaster />
  </SidebarProvider>
</template>
