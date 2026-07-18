import { computed, nextTick, ref, type ComponentPublicInstance } from 'vue'
import useFleetSidebar from '@/composables/use-fleet-sidebar'
import type { FleetSidebarProject } from '@/types/fleet/fleet-sidebar-project'

const searchOpen = ref(false)
const searchQuery = ref('')
const runningOnly = ref(false)
const searchInputEl = ref<HTMLInputElement | ComponentPublicInstance | null>(null)

const focusSearchInput = (): void => {
  const target = searchInputEl.value
  if (target instanceof HTMLInputElement) {
    target.focus()
    return
  }
  if (target && '$el' in target && target.$el instanceof HTMLInputElement) {
    target.$el.focus()
  }
}

export default () => {
  const fleetSidebar = useFleetSidebar()

  const filteredProjects = computed<FleetSidebarProject[]>(() => {
    const query = searchQuery.value.trim().toLowerCase()

    return fleetSidebar.sidebarProjects.value
      .map((project) => {
        let chats = project.chats

        if (runningOnly.value) {
          chats = chats.filter((chat) => chat.status === 'running')
        }

        if (query) {
          const nameMatches = project.displayName.toLowerCase().includes(query)
          const matchingChats = chats.filter((chat) =>
            chat.title.toLowerCase().includes(query),
          )

          if (!nameMatches && matchingChats.length === 0) {
            return null
          }

          chats = nameMatches ? chats : matchingChats
        }

        return {
          ...project,
          chats,
        }
      })
      .filter((project): project is FleetSidebarProject => project !== null)
  })

  const toggleRunningFilter = (): void => {
    runningOnly.value = !runningOnly.value
  }

  const openSearch = async (): Promise<void> => {
    searchOpen.value = true
    await nextTick()
    focusSearchInput()
  }

  const closeSearch = (): void => {
    searchOpen.value = false
    searchQuery.value = ''
  }

  return {
    searchOpen,
    searchQuery,
    runningOnly,
    searchInputEl,
    filteredProjects,
    toggleRunningFilter,
    openSearch,
    closeSearch,
  }
}
