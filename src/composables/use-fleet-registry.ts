import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { FleetProject } from '@/types/fleet/fleet-project'
import {
  getActiveProjectId,
  hasProjectPyrola,
  isTauri,
  lspPrefetchDefaults,
  registryListProjects,
  registryRemoveProject,
  registrySetActiveProject,
} from '@/services/pyrola/pyrola-tauri'

const projects = ref<FleetProject[]>([])
const activeProjectId = ref<string | null>(null)
const hasProjectPyrolaFlag = ref(false)
const loaded = ref(false)

const mapProject = (record: {
  id: string
  name: string
  slug: string
  root_path: string
  last_opened: string
}): FleetProject => ({
  id: record.id,
  name: record.name,
  slug: record.slug,
  rootPath: record.root_path,
  lastOpened: record.last_opened,
})

export default () => {
  const activeProject = computed(
    () => projects.value.find((p) => p.id === activeProjectId.value) ?? null,
  )

  const refreshHasPyrola = async (): Promise<void> => {
    if (!activeProject.value) {
      hasProjectPyrolaFlag.value = false
      return
    }
    hasProjectPyrolaFlag.value = await hasProjectPyrola(activeProject.value.rootPath)
  }

  const refresh = async (): Promise<void> => {
    const records = await registryListProjects()
    projects.value = records.map(mapProject)
    const persistedActiveId = await getActiveProjectId()
    activeProjectId.value =
      persistedActiveId && projects.value.some((project) => project.id === persistedActiveId)
        ? persistedActiveId
        : null
    await refreshHasPyrola()
    loaded.value = true
  }

  const setActiveProject = async (projectId: string | null): Promise<void> => {
    await registrySetActiveProject(projectId)
    activeProjectId.value = projectId
    await refreshHasPyrola()
    if (projectId && isTauri()) {
      try {
        await lspPrefetchDefaults()
      } catch (error) {
        toast.error('Failed to prepare language support', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }

  const removeProject = async (projectId: string): Promise<void> => {
    await registryRemoveProject(projectId)
    await refresh()
  }

  // Keep an active selection when projects exist; never invent one from CWD.
  // An empty registry is valid — user adds via folder picker or home chat.
  const ensureDefaultProject = async (): Promise<void> => {
    if (projects.value.length === 0) {
      if (activeProjectId.value) {
        await setActiveProject(null)
      }
      return
    }
    if (
      !activeProjectId.value ||
      !projects.value.some((project) => project.id === activeProjectId.value)
    ) {
      await setActiveProject(projects.value[0]!.id)
    }
  }

  onMounted(async () => {
    if (!loaded.value) {
      try {
        await refresh()
        await ensureDefaultProject()
      } catch (error) {
        toast.error('Failed to load fleet registry', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  })

  return {
    projects,
    activeProject,
    activeProjectId,
    hasProjectPyrola: hasProjectPyrolaFlag,
    loaded,
    refresh,
    setActiveProject,
    removeProject,
    ensureDefaultProject,
  }
}
