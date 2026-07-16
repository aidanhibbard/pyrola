<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { toast } from 'vue-sonner'
import useFleetSidebar from '@/composables/use-fleet-sidebar'
import useFleetRegistry from '@/composables/use-fleet-registry'
import {
  SidebarGroup,
  SidebarMenu,
} from '@/components/shadcn/ui/sidebar'
import NavigationAsideLeftProjectRow from '@/components/navigation/aside/left/ProjectRow.vue'
import NavigationAsideLeftProjectsSectionHeader from '@/components/navigation/aside/left/ProjectsSectionHeader.vue'

const { sidebarProjects, refreshAll } = useFleetSidebar()
const fleet = useFleetRegistry()

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
    <SidebarMenu>
      <NavigationAsideLeftProjectRow
        v-for="project in sidebarProjects"
        :key="project.slug"
        :project="project"
      />
    </SidebarMenu>
  </SidebarGroup>
</template>
