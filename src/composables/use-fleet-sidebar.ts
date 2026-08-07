import { computed, ref } from 'vue'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useChatStore from '@/composables/use-chat-store'
import type { FleetSidebarProject } from '@/types/fleet/fleet-sidebar-project'
import type { ChatMeta } from '@/types/chat/chat-meta'
import { listPinnedChats } from '@/services/pyrola/pyrola-tauri'
import type { FleetPinnedChat } from '@/types/fleet/fleet-pinned-chat'
import { HOME_CHAT_SLUG } from '@/constants/home-chat'

export type FleetSidebarActivityItem =
  | {
      kind: 'project'
      project: FleetSidebarProject
      updatedAt: string
    }
  | {
      kind: 'standalone'
      chat: {
        id: string
        title: string
        status?: ChatMeta['status']
        attention?: ChatMeta['attention']
        projectSlug: string
      }
      updatedAt: string
    }

const pinnedChats = ref<FleetPinnedChat[]>([])
const chatsBySlug = ref<Record<string, ChatMeta[]>>({})

const maxUpdatedAt = (chats: ChatMeta[]): string => {
  if (chats.length === 0) {
    return ''
  }
  return chats.reduce(
    (latest, chat) => (chat.updatedAt > latest ? chat.updatedAt : latest),
    chats[0]!.updatedAt,
  )
}

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
        status: chat.status,
        attention: chat.attention ?? null,
      })),
    })),
  )

  const standaloneChats = computed(() => chatsBySlug.value[HOME_CHAT_SLUG] ?? [])

  const activityItems = computed<FleetSidebarActivityItem[]>(() => {
    const items: FleetSidebarActivityItem[] = []

    for (const project of sidebarProjects.value) {
      const metas = chatsBySlug.value[project.slug] ?? []
      items.push({
        kind: 'project',
        project,
        updatedAt: maxUpdatedAt(metas) || '1970-01-01T00:00:00.000Z',
      })
    }

    for (const chat of standaloneChats.value) {
      items.push({
        kind: 'standalone',
        chat: {
          id: chat.id,
          title: chat.title,
          status: chat.status,
          attention: chat.attention ?? null,
          projectSlug: HOME_CHAT_SLUG,
        },
        updatedAt: chat.updatedAt,
      })
    }

    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })

  const refreshSlug = async (projectSlug: string): Promise<void> => {
    const chats = await chatStore.listProjectChats(projectSlug)
    chatsBySlug.value = {
      ...chatsBySlug.value,
      [projectSlug]: chats,
    }
  }

  const refreshChats = async (): Promise<void> => {
    const next: typeof chatsBySlug.value = {}
    for (const project of fleet.projects.value) {
      next[project.slug] = await chatStore.listProjectChats(project.slug)
    }
    next[HOME_CHAT_SLUG] = await chatStore.listProjectChats(HOME_CHAT_SLUG)
    chatsBySlug.value = next
  }

  const refreshPinned = async (): Promise<void> => {
    const records = await listPinnedChats()
    pinnedChats.value = records.map((record) => ({
      chatId: record.id,
      title: record.title,
      projectSlug: record.projectSlug,
      projectLabel: isHomeLabel(record.projectSlug)
        ? 'Home'
        : record.projectSlug,
    }))
  }

  const refreshAll = async (): Promise<void> => {
    await refreshChats()
    await refreshPinned()
  }

  return {
    sidebarProjects,
    standaloneChats,
    activityItems,
    pinnedChats,
    refreshChats,
    refreshSlug,
    refreshPinned,
    refreshAll,
  }
}

const isHomeLabel = (slug: string): boolean => slug === HOME_CHAT_SLUG

export const refreshFleetSidebar = async (): Promise<void> => {
  const fleet = useFleetRegistry()
  const chatStore = useChatStore()
  const next: typeof chatsBySlug.value = {}
  for (const project of fleet.projects.value) {
    next[project.slug] = await chatStore.listProjectChats(project.slug)
  }
  next[HOME_CHAT_SLUG] = await chatStore.listProjectChats(HOME_CHAT_SLUG)
  chatsBySlug.value = next
  const records = await listPinnedChats()
  pinnedChats.value = records.map((record) => ({
    chatId: record.id,
    title: record.title,
    projectSlug: record.projectSlug,
    projectLabel: record.projectSlug === HOME_CHAT_SLUG ? 'Home' : record.projectSlug,
  }))
}
