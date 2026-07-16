import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import type { FleetProject } from '@/types/fleet/fleet-project'
import {
  getActiveProjectId,
  getDefaultWorkspaceRoot,
  hasProjectPyrola,
  registryAddProject,
  registryListProjects,
  registryRemoveProject,
  registrySetActiveProject,
  registryUpdateProjectRoot,
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

const normalizeProjectRoots = async (): Promise<void> => {
  const workspaceRoot = await getDefaultWorkspaceRoot()
  for (const project of projects.value) {
    if (project.rootPath === workspaceRoot) {
      continue
    }
    const record = await registryUpdateProjectRoot(project.id, workspaceRoot)
    const index = projects.value.findIndex((item) => item.id === project.id)
    if (index >= 0) {
      projects.value[index] = mapProject(record)
    }
  }
}

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
    activeProjectId.value = await getActiveProjectId()
    await normalizeProjectRoots()
    await refreshHasPyrola()
    loaded.value = true
  }

  const setActiveProject = async (projectId: string): Promise<void> => {
    await registrySetActiveProject(projectId)
    activeProjectId.value = projectId
    await refreshHasPyrola()
  }

  const removeProject = async (projectId: string): Promise<void> => {
    await registryRemoveProject(projectId)
    await refresh()
    if (projects.value.length === 0) {
      await ensureDefaultProject()
    }
  }

  const ensureDefaultProject = async (): Promise<void> => {
    const workspaceRoot = await getDefaultWorkspaceRoot()

    if (projects.value.length > 0) {
      if (!activeProjectId.value) {
        await setActiveProject(projects.value[0]!.id)
      }
      return
    }

    const project = await registryAddProject('pyrola', workspaceRoot)
    projects.value = [mapProject(project)]
    await setActiveProject(project.id)
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
