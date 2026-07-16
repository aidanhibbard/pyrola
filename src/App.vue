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

useVibrancy()

const rightSidebarOpen = ref(false)
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <RightSidebarProvider v-model:open="rightSidebarOpen" class="h-svh flex-1">
        <TitleBar />
        <ResizablePanelGroup direction="horizontal" class="flex-1 overflow-hidden">
          <ResizablePanel :min-size="30">
            <main
              class="h-full overflow-auto pt-(--titlebar-height)"
              style="--titlebar-height: 40px"
            >
              <slot />
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
