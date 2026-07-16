import { computed, ref } from 'vue'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useChatStore from '@/composables/use-chat-store'
import type { FleetSidebarProject } from '@/types/fleet/fleet-sidebar-project'
import { listPinnedChats } from '@/services/pyrola/pyrola-tauri'
import type { FleetPinnedChat } from '@/types/fleet/fleet-pinned-chat'

const pinnedChats = ref<FleetPinnedChat[]>([])
const chatsBySlug = ref<Record<string, Awaited<ReturnType<ReturnType<typeof useChatStore>['listProjectChats']>>>>({})

export default () => {
  const fleet = useFleetRegistry()
  const chatStore = useChatStore()

  const sidebarProjects = computed<FleetSidebarProject[]>(() =>
    fleet.projects.value.map((project) => ({
      slug: project.slug,
      displayName: project.name,
      isActiveProject: fleet.activeProjectId.value === project.id,
      defaultExpanded: fleet.activeProjectId.value === project.id,
      chats: (chatsBySlug.value[project.slug] ?? []).map((chat) => ({
        id: chat.id,
        title: chat.title,
      })),
    })),
  )

  const refreshChats = async (): Promise<void> => {
    const next: typeof chatsBySlug.value = {}
    for (const project of fleet.projects.value) {
      next[project.slug] = await chatStore.listProjectChats(project.slug)
    }
    chatsBySlug.value = next
  }

  const refreshPinned = async (): Promise<void> => {
    const records = await listPinnedChats()
    pinnedChats.value = records.map((record) => ({
      chatId: record.id,
      title: record.title,
      projectSlug: record.projectSlug,
      projectLabel: record.projectSlug,
    }))
  }

  const refreshAll = async (): Promise<void> => {
    await refreshChats()
    await refreshPinned()
  }

  return {
    sidebarProjects,
    pinnedChats,
    refreshChats,
    refreshPinned,
    refreshAll,
  }
}

export const refreshFleetSidebar = async (): Promise<void> => {
  const fleet = useFleetRegistry()
  const chatStore = useChatStore()
  const next: typeof chatsBySlug.value = {}
  for (const project of fleet.projects.value) {
    next[project.slug] = await chatStore.listProjectChats(project.slug)
  }
  chatsBySlug.value = next
  const records = await listPinnedChats()
  pinnedChats.value = records.map((record) => ({
    chatId: record.id,
    title: record.title,
    projectSlug: record.projectSlug,
    projectLabel: record.projectSlug,
  }))
}
