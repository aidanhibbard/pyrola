<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Pin, PinOff } from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/shadcn/ui/breadcrumb'
import { Button } from '@/components/shadcn/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
import useChatStore from '@/composables/use-chat-store'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useFleetSidebar, { refreshFleetSidebar } from '@/composables/use-fleet-sidebar'
import { pinChat } from '@/services/pyrola/pyrola-tauri'

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

const pinning = ref(false)

const isPinned = computed(() =>
  fleetSidebar.pinnedChats.value.some(
    (chat) => chat.chatId === chatId.value && chat.projectSlug === projectSlug.value,
  ),
)

const handleTogglePin = async (): Promise<void> => {
  if (pinning.value || !projectSlug.value || !chatId.value) {
    return
  }

  const nextPinned = !isPinned.value
  pinning.value = true
  try {
    await pinChat(projectSlug.value, chatId.value, nextPinned)
    await refreshFleetSidebar()
    toast.success(nextPinned ? 'Chat pinned' : 'Chat unpinned')
  } catch (error) {
    toast.error(nextPinned ? 'Could not pin chat' : 'Could not unpin chat', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    pinning.value = false
  }
}
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
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 shrink-0"
          :disabled="pinning"
          :aria-label="isPinned ? 'Unpin chat' : 'Pin chat'"
          @click="handleTogglePin"
        >
          <PinOff v-if="isPinned" class="size-4" />
          <Pin v-else class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ isPinned ? 'Unpin chat' : 'Pin chat' }}</TooltipContent>
    </Tooltip>
  </div>
</template>
