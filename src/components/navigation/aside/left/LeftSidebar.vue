<script setup lang="ts">
import type { SidebarProps } from '@/components/shadcn/ui/sidebar'
import NavFooter from './NavFooter.vue'
import NavHeader from './NavHeader.vue'
import NavProjects from './NavProjects.vue'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/shadcn/ui/sidebar'

const props = withDefaults(defineProps<SidebarProps>(), {
  collapsible: 'offcanvas',
})
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <NavHeader />
    </SidebarHeader>
    <SidebarContent>
      <NavProjects />
    </SidebarContent>
    <SidebarFooter>
      <NavFooter />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
