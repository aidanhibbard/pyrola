<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Folder, FolderOpen, PanelLeftClose, Plus } from '@lucide/vue'
import type { FleetSidebarProject } from '@/types/fleet/fleet-sidebar-project'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/ui/collapsible'
import { Button } from '@/components/shadcn/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/shadcn/ui/context-menu'
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from '@/components/shadcn/ui/sidebar'
import NavigationAsideLeftChatListItem from '@/components/navigation/aside/left/ChatListItem.vue'
import useChatStore from '@/composables/use-chat-store'
import useFleetRegistry from '@/composables/use-fleet-registry'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import { refreshFleetSidebar } from '@/composables/use-fleet-sidebar'

const props = defineProps<{
  project: FleetSidebarProject
}>()

const route = useRoute()
const router = useRouter()
const fleet = useFleetRegistry()
const chatStore = useChatStore()
const config = usePyrolaConfig()
const startingChat = ref(false)
const removingProject = ref(false)

const handleStartChat = async (): Promise<void> => {
  if (startingChat.value) {
    return
  }

  const fleetProject = fleet.projects.value.find(
    (item) => item.slug === props.project.slug,
  )
  if (!fleetProject) {
    toast.error('Project not found')
    return
  }

  startingChat.value = true
  try {
    await fleet.setActiveProject(fleetProject.id)
    const chat = await chatStore.createNewChat({
      projectSlug: fleetProject.slug,
      projectRoot: fleetProject.rootPath,
      mode: config.effectiveSettings.value['agent.defaultMode'] ?? 'agent',
      model: config.effectiveSettings.value['agent.defaultModel'] ?? '',
    })
    await refreshFleetSidebar()
    await router.push(`/project/${fleetProject.slug}/chat/${chat.id}`)
  } catch (error) {
    toast.error('Could not start chat', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    startingChat.value = false
  }
}

const handleRemoveFromSidebar = async (): Promise<void> => {
  if (removingProject.value) {
    return
  }

  const fleetProject = fleet.projects.value.find(
    (item) => item.slug === props.project.slug,
  )
  if (!fleetProject) {
    return
  }

  removingProject.value = true
  try {
    await fleet.removeProject(fleetProject.id)
    await refreshFleetSidebar()
    if (route.params.slug === props.project.slug) {
      await router.push('/')
    }
    toast.success('Project removed from sidebar')
  } catch (error) {
    toast.error('Could not remove project', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    removingProject.value = false
  }
}
</script>

<template>
  <Collapsible
    as-child
    :default-open="project.defaultExpanded"
    class="group/collapsible"
  >
    <SidebarMenuItem>
      <ContextMenu>
        <ContextMenuTrigger as-child>
          <CollapsibleTrigger as-child>
            <SidebarMenuButton :tooltip="project.displayName">
              <Folder
                class="size-4 shrink-0 group-data-[state=open]/collapsible:hidden"
              />
              <FolderOpen
                class="hidden size-4 shrink-0 group-data-[state=open]/collapsible:block"
              />
              <span class="min-w-0 flex-1 truncate">{{ project.displayName }}</span>
            </SidebarMenuButton>
          </CollapsibleTrigger>
        </ContextMenuTrigger>
        <ContextMenuContent class="w-52">
          <ContextMenuItem
            :disabled="removingProject"
            @select="handleRemoveFromSidebar"
          >
            <PanelLeftClose />
            Remove from sidebar
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <SidebarMenuAction as-child>
        <Button
          variant="ghost"
          size="icon"
          class="size-6"
          :disabled="startingChat"
          :title="`New chat in ${project.displayName}`"
          @click.stop="handleStartChat"
        >
          <Plus class="size-3.5" />
          <span class="sr-only">New chat in {{ project.displayName }}</span>
        </Button>
      </SidebarMenuAction>
      <CollapsibleContent>
        <div class="min-w-0 max-h-42 overflow-x-hidden overflow-y-auto pl-3.5">
          <SidebarMenuSub class="mx-0 gap-0.5">
            <SidebarMenuSubItem
              v-for="chat in project.chats"
              :key="chat.id"
            >
              <NavigationAsideLeftChatListItem
                :chat="chat"
                :project-slug="project.slug"
              />
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </div>
      </CollapsibleContent>
    </SidebarMenuItem>
  </Collapsible>
</template>
