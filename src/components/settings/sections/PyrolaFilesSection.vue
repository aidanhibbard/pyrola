<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ExternalLink, Folder } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import SettingsSectionScroll from '@/components/settings/SettingsSectionScroll.vue'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import useFleetRegistry from '@/composables/use-fleet-registry'
import useWorkbenchStore from '@/composables/use-workbench-store'
import type { SettingsTab } from '@/composables/use-pyrola-config'
import {
  lastPyrolaFileChange,
  pyrolaFileChangeToken,
} from '@/composables/use-pyrola-live-sync'
import type { PyrolaFilesKind } from '@/services/pyrola/pyrola-tauri'
import {
  getPyrolaDir,
  listPyrolaFiles,
  revealInFolder,
  type ProjectFileEntry,
} from '@/services/pyrola/pyrola-tauri'

const props = defineProps<{
  tab: SettingsTab
  kind: PyrolaFilesKind
  title: string
  emptyMessage: string
  folderLabel: string
}>()

const config = usePyrolaConfig()
const fleet = useFleetRegistry()
const workbench = useWorkbenchStore()
const files = ref<ProjectFileEntry[]>([])

const load = async (): Promise<void> => {
  if (props.tab === 'project' && !config.activeRootPath.value) {
    files.value = []
    return
  }

  files.value = await listPyrolaFiles(
    props.tab === 'personal' ? 'personal' : 'project',
    props.kind,
    config.activeRootPath.value,
  )
}

onMounted(async () => {
  try {
    await load()
  } catch (error) {
    toast.error('Failed to load files', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

watch(
  () => [props.tab, config.activeRootPath.value] as const,
  async () => {
    try {
      await load()
    } catch (error) {
      toast.error('Failed to load files', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },
)

watch(pyrolaFileChangeToken, async () => {
  const change = lastPyrolaFileChange.value
  if (change?.kind !== props.kind) {
    return
  }
  if (change.scope === 'personal' && props.tab !== 'personal') {
    return
  }
  if (change.scope === 'project' && props.tab !== 'project') {
    return
  }
  try {
    await load()
  } catch (error) {
    toast.error('Failed to load files', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

const revealRoot = async (): Promise<void> => {
  const scope = props.tab === 'personal' ? 'personal' : 'project'
  const dir = await getPyrolaDir(scope, config.activeRootPath.value)
  await revealInFolder(`${dir}/${props.folderLabel}`)
}

const toRelativePath = (absolutePath: string): string => {
  const root = config.activeRootPath.value
  if (root && absolutePath.startsWith(root)) {
    return absolutePath.slice(root.length).replace(/^\//, '')
  }
  return absolutePath
}

const resolveProjectIdForSettings = (): string | null => {
  const root = config.activeRootPath.value
  if (props.tab === 'project' && root) {
    const match = fleet.projects.value.find((project) => project.rootPath === root)
    if (match) {
      return match.id
    }
  }
  return fleet.activeProjectId.value
}

const openInEditor = (file: ProjectFileEntry): void => {
  const projectId = resolveProjectIdForSettings()
  if (!projectId) {
    return
  }

  const relativePath = toRelativePath(file.path)

  if (props.kind === 'plans') {
    workbench.openPlan(projectId, file.name, relativePath, file.name)
    return
  }

  if (props.kind === 'studio') {
    workbench.openStudio(
      projectId,
      file.name,
      relativePath,
      file.description ?? file.name,
    )
    return
  }

  workbench.openEditor(projectId, relativePath)
}
</script>

<template>
  <SettingsSectionScroll :title="title">
    <template #actions>
      <Button variant="outline" size="sm" @click="revealRoot">Reveal in folder</Button>
    </template>

    <p v-if="files.length === 0" class="text-sm text-muted-foreground">{{ emptyMessage }}</p>

    <div v-else class="space-y-2">
      <div
        v-for="file in files"
        :key="file.path"
        class="flex items-center justify-between rounded-lg border border-border/50 px-4 py-2"
      >
        <div>
          <p class="font-medium">{{ file.description ?? file.name }}</p>
          <p
            v-if="kind === 'studio' && file.description && file.description !== file.name"
            class="text-xs text-muted-foreground"
          >
            {{ file.name }}
          </p>
        </div>
        <div class="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            aria-label="Open in editor"
            @click="openInEditor(file)"
          >
            <ExternalLink class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            aria-label="Reveal in folder"
            @click="revealInFolder(file.path)"
          >
            <Folder class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  </SettingsSectionScroll>
</template>
