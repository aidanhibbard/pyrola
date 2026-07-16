<script setup lang="ts">
import type { FleetSidebarProject } from '@/types/fleet/fleet-sidebar-project'
import { ChevronRight } from '@lucide/vue'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/ui/collapsible'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from '@/components/shadcn/ui/sidebar'
import NavigationAsideLeftChatListItem from '@/components/navigation/aside/left/ChatListItem.vue'

defineProps<{
  project: FleetSidebarProject
}>()
</script>

<template>
  <Collapsible
    as-child
    :default-open="project.defaultExpanded"
    class="group/collapsible"
  >
    <SidebarMenuItem>
      <CollapsibleTrigger as-child>
        <SidebarMenuButton :tooltip="project.displayName">
          <ChevronRight
            class="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
          />
          <span class="truncate">{{ project.displayName }}</span>
        </SidebarMenuButton>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub class="gap-0.5">
          <SidebarMenuSubItem
            v-for="chat in project.chats"
            :key="chat.id"
          >
            <NavigationAsideLeftChatListItem :chat="chat" />
          </SidebarMenuSubItem>
        </SidebarMenuSub>
      </CollapsibleContent>
    </SidebarMenuItem>
  </Collapsible>
</template>
