<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { toast } from 'vue-sonner'
import { X } from '@lucide/vue'
import useFleetSidebar from '@/composables/use-fleet-sidebar'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useProjectsSection from '@/composables/use-projects-section'
import { Button } from '@/components/shadcn/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
import { Input } from '@/components/shadcn/ui/input'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/shadcn/ui/sidebar'
import NavigationAsideLeftProjectRow from '@/components/navigation/aside/left/ProjectRow.vue'
import NavigationAsideLeftChatListItem from '@/components/navigation/aside/left/ChatListItem.vue'
import NavigationAsideLeftProjectsSectionHeader from '@/components/navigation/aside/left/ProjectsSectionHeader.vue'
import { HOME_CHAT_SLUG } from '@/constants/home-chat'

const { refreshAll } = useFleetSidebar()
const fleet = useFleetRegistry()
const {
  searchOpen,
  searchQuery,
  searchInputEl,
  filteredActivityItems,
  closeSearch,
} = useProjectsSection()

onMounted(() => {
  refreshAll().catch((error) => {
    toast.error('Failed to load projects', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
})

watch(
  () => fleet.loaded.value,
  (loaded) => {
    if (loaded) {
      refreshAll().catch((error) => {
        toast.error('Failed to load projects', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    }
  },
  { immediate: true },
)
</script>

<template>
  <SidebarGroup>
    <div class="sticky top-0 z-10 bg-sidebar">
      <NavigationAsideLeftProjectsSectionHeader />
      <div
        v-if="searchOpen"
        class="flex items-center gap-1 px-2 pb-1"
      >
        <Input
          ref="searchInputEl"
          v-model="searchQuery"
          type="search"
          placeholder="Filter projects and chats…"
          class="h-7 flex-1 text-xs"
        />
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-6 shrink-0"
              aria-label="Close search"
              @click="closeSearch"
            >
              <X class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close search</TooltipContent>
        </Tooltip>
      </div>
    </div>
    <SidebarMenu>
      <template
        v-for="item in filteredActivityItems"
        :key="item.kind === 'project' ? `project-${item.project.slug}` : `chat-${item.chat.id}`"
      >
        <NavigationAsideLeftProjectRow
          v-if="item.kind === 'project'"
          :project="item.project"
        />
        <SidebarMenuItem v-else>
          <NavigationAsideLeftChatListItem
            :chat="item.chat"
            :project-slug="HOME_CHAT_SLUG"
          />
        </SidebarMenuItem>
      </template>
    </SidebarMenu>
  </SidebarGroup>
</template>
