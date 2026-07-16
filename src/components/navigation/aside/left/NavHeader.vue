<script setup lang="ts">
import { Bot, Pin, Search, Settings } from '@lucide/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/shadcn/ui/sidebar'
</script>

<template>
  <SidebarMenu class="pt-8">
    <SidebarMenuItem>
      <SidebarMenuButton tooltip="New Agent">
        <Bot />
        <span>New Agent</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
    <SidebarMenuItem>
      <SidebarMenuButton tooltip="Search">
        <Search />
        <span>Search</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton tooltip="Pinned">
            <Pin />
            <span>Pinned</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-48 rounded-lg" side="bottom" align="start">
          <DropdownMenuItem>
            <span>No pinned items</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
    <SidebarMenuItem>
      <SidebarMenuButton tooltip="Settings">
        <Settings />
        <span>Settings</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
