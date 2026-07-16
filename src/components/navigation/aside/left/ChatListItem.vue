<script setup lang="ts">
import type { FleetSidebarChat } from '@/types/fleet/fleet-sidebar-chat'
import { SidebarMenuSubButton } from '@/components/shadcn/ui/sidebar'

defineProps<{
  chat: FleetSidebarChat
}>()
</script>

<template>
  <SidebarMenuSubButton
    as="button"
    type="button"
    class="h-8 w-full gap-1.5 px-2"
  >
    <span class="min-w-0 flex-1 truncate text-left text-sm">
      {{ chat.title }}
    </span>
    <span class="shrink-0 text-xs text-muted-foreground tabular-nums">
      {{ chat.updatedAtLabel }}
    </span>
  </SidebarMenuSubButton>
</template>
