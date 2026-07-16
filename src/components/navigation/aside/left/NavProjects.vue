<script setup lang="ts">
import { MOCK_FLEET_PROJECTS } from '@/data/mock-fleet-projects'
import {
  SidebarGroup,
  SidebarMenu,
} from '@/components/shadcn/ui/sidebar'
import NavigationAsideLeftProjectRow from '@/components/navigation/aside/left/ProjectRow.vue'
import NavigationAsideLeftProjectsSectionHeader from '@/components/navigation/aside/left/ProjectsSectionHeader.vue'

const projects = MOCK_FLEET_PROJECTS
</script>

<template>
  <SidebarGroup class="px-0">
    <NavigationAsideLeftProjectsSectionHeader />
    <SidebarMenu>
      <NavigationAsideLeftProjectRow
        v-for="project in projects"
        :key="project.slug"
        :project="project"
      />
    </SidebarMenu>
  </SidebarGroup>
</template>
