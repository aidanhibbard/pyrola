<script setup lang="ts">
import { Settings } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/shadcn/ui/sidebar'
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton tooltip="Settings" as-child>
        <RouterLink to="/settings">
          <Settings />
          <span>Settings</span>
        </RouterLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
