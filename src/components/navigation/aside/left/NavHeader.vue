<script setup lang="ts">
import { Bot, Pin, Search, Settings } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { MOCK_PINNED_CHATS } from '@/data/mock-fleet-projects'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/shadcn/ui/sidebar'

const { push } = useRouter()
const pinnedChats = MOCK_PINNED_CHATS
</script>

<template>
  <SidebarMenu class="pt-8">
    <SidebarMenuItem>
      <SidebarMenuButton tooltip="New Agent" @click="push('/')">
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
        <DropdownMenuContent class="w-64 rounded-lg" side="bottom" align="start">
          <DropdownMenuLabel>Pinned</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <template v-if="pinnedChats.length > 0">
            <DropdownMenuItem
              v-for="chat in pinnedChats"
              :key="chat.chatId"
              class="flex items-center justify-between gap-2"
            >
              <span class="truncate">{{ chat.title }}</span>
              <span class="shrink-0 text-xs text-muted-foreground">
                {{ chat.projectLabel }}
              </span>
            </DropdownMenuItem>
          </template>
          <DropdownMenuItem v-else disabled> No pinned chats </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
    <SidebarMenuItem>
      <SidebarMenuButton tooltip="Settings" @click="push('/settings')">
        <Settings />
        <span>Settings</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
