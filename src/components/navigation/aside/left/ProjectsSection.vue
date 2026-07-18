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
} from '@/components/shadcn/ui/sidebar'
import NavigationAsideLeftProjectRow from '@/components/navigation/aside/left/ProjectRow.vue'
import NavigationAsideLeftProjectsSectionHeader from '@/components/navigation/aside/left/ProjectsSectionHeader.vue'

const { refreshAll } = useFleetSidebar()
const fleet = useFleetRegistry()
const {
  searchOpen,
  searchQuery,
  searchInputEl,
  filteredProjects,
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
  <SidebarGroup class="px-0">
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
    <SidebarMenu>
      <NavigationAsideLeftProjectRow
        v-for="project in filteredProjects"
        :key="project.slug"
        :project="project"
      />
    </SidebarMenu>
  </SidebarGroup>
</template>
