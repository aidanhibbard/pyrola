<script setup lang="ts">
import {
  ChevronsDownUp,
  Filter,
  FolderPlus,
  Search,
} from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'
import { SidebarGroupLabel } from '@/components/shadcn/ui/sidebar'
</script>

<template>
  <div class="flex h-8 items-center justify-between gap-1 px-2">
    <SidebarGroupLabel class="h-auto px-0">
      Projects
    </SidebarGroupLabel>
    <div class="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        class="size-6"
        title="Filter projects and chats"
      >
        <Search class="size-3.5" />
        <span class="sr-only">Search projects and chats</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="size-6"
        title="Filter by running status"
      >
        <Filter class="size-3.5" />
        <span class="sr-only">Filter by status</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="size-6"
        title="Add project"
      >
        <FolderPlus class="size-3.5" />
        <span class="sr-only">Add project</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="size-6"
        title="Collapse all projects"
      >
        <ChevronsDownUp class="size-3.5" />
        <span class="sr-only">Collapse all projects</span>
      </Button>
    </div>
  </div>
</template>
