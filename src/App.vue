<script setup lang="ts">
import AppSidebar from "@/components/navigation/aside/left/LeftSidebar.vue"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/shadcn/ui/sidebar"
import AppHeader from "./components/navigation/header/AppHeader.vue";
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <AppHeader />
      <main>
        <slot />
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>
