<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/shadcn/ui/breadcrumb'
import useChatStore from '@/composables/use-chat-store'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useFleetSidebar from '@/composables/use-fleet-sidebar'

const route = useRoute()
const fleet = useFleetRegistry()
const fleetSidebar = useFleetSidebar()
const chatStore = useChatStore()

const projectSlug = computed(() => String(route.params.slug ?? ''))
const chatId = computed(() => String(route.params.chatId ?? ''))

const isChatRoute = computed(() => route.name === 'chat' && projectSlug.value && chatId.value)

const projectName = computed(() => {
  const project = fleet.projects.value.find((item) => item.slug === projectSlug.value)
  return project?.name ?? projectSlug.value
})

const chatTitle = computed(() => {
  const meta = chatStore.meta.value
  if (meta?.id === chatId.value && meta.title) {
    return meta.title
  }

  const sidebarProject = fleetSidebar.sidebarProjects.value.find(
    (item) => item.slug === projectSlug.value,
  )
  const sidebarChat = sidebarProject?.chats.find((item) => item.id === chatId.value)
  if (sidebarChat?.title) {
    return sidebarChat.title
  }

  return 'Chat'
})
</script>

<template>
  <div v-if="isChatRoute" class="flex min-w-0 flex-1 items-center gap-1">
    <Breadcrumb class="min-w-0 flex-1">
      <BreadcrumbList class="flex min-w-0 items-center gap-1.5">
        <BreadcrumbItem class="shrink-0">
          <BreadcrumbLink as-child>
            <RouterLink
              :to="{ name: 'home' }"
              class="block max-w-[10rem] truncate sm:max-w-[12rem]"
              :title="projectName"
            >
              {{ projectName }}
            </RouterLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator class="shrink-0" />
        <BreadcrumbItem class="min-w-0 flex-1 overflow-hidden">
          <BreadcrumbPage class="block truncate" :title="chatTitle">
            {{ chatTitle }}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  </div>
</template>
