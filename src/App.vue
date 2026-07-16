<script setup lang="ts">
import AppSidebar from "@/components/navigation/aside/left/LeftSidebar.vue"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/shadcn/ui/sidebar"
import RightSidebarProvider from "@/components/navigation/aside/right/RightSidebarProvider.vue"
import RightSidebar from "@/components/navigation/aside/right/RightSidebar.vue"
import TitleBar from "@/components/navigation/header/TitleBar.vue"
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <RightSidebarProvider class="h-svh flex-1">
        <TitleBar />
        <div class="flex flex-1 overflow-hidden">
          <main class="flex-1 overflow-auto pt-(--titlebar-height)" style="--titlebar-height: 40px">
            <slot />
          </main>
          <RightSidebar class="pt-(--titlebar-height)" style="--titlebar-height: 40px" />
        </div>
      </RightSidebarProvider>
    </SidebarInset>
  </SidebarProvider>
</template>
