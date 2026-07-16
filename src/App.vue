<script setup lang="ts">
import { ref } from 'vue'
import AppSidebar from '@/components/navigation/aside/left/LeftSidebar.vue'
import { SidebarInset, SidebarProvider } from '@/components/shadcn/ui/sidebar'
import RightSidebarProvider from '@/components/navigation/aside/right/RightSidebarProvider.vue'
import RightSidebar from '@/components/navigation/aside/right/RightSidebar.vue'
import TitleBar from '@/components/navigation/header/TitleBar.vue'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/shadcn/ui/resizable'
import { Toaster } from '@/components/shadcn/ui/sonner'
import useVibrancy from '@/composables/use-vibrancy'
import usePyrolaLiveSync from '@/composables/use-pyrola-live-sync'
import useFleetRegistry from '@/composables/use-fleet-registry'
import { RouterView } from 'vue-router'

useFleetRegistry()
useVibrancy()
usePyrolaLiveSync()

const rightSidebarOpen = ref(false)
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <RightSidebarProvider v-model:open="rightSidebarOpen" class="h-svh flex-1">
        <TitleBar />
        <ResizablePanelGroup direction="horizontal" class="min-h-0 flex-1 overflow-hidden">
          <ResizablePanel :min-size="30" class="h-full min-h-0">
            <main
              class="flex h-full min-h-0 flex-col overflow-hidden pt-(--titlebar-height)"
              style="--titlebar-height: 40px"
            >
              <RouterView class="min-h-0 flex-1" />
            </main>
          </ResizablePanel>
          <ResizableHandle v-if="rightSidebarOpen" />
          <ResizablePanel v-if="rightSidebarOpen" :default-size="25" :min-size="15" :max-size="50">
            <RightSidebar class="pt-(--titlebar-height)" style="--titlebar-height: 40px" />
          </ResizablePanel>
        </ResizablePanelGroup>
      </RightSidebarProvider>
    </SidebarInset>
    <Toaster />
  </SidebarProvider>
</template>
