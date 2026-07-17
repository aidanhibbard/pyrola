<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import useWorkbenchStore from '@/composables/use-workbench-store'
import { gitStatus } from '@/services/pyrola/pyrola-tauri'
import type { WorkbenchTab } from '@/types/workbench/workbench-tab'

type GitStatusEntry = {
  path: string
  oldPath?: string | null
  stagedStatus?: string | null
  unstagedStatus?: string | null
  isUntracked?: boolean
}

const props = defineProps<{
  tab: WorkbenchTab
}>()

const workbench = useWorkbenchStore()
const branch = ref<string | null>(null)
const entries = ref<GitStatusEntry[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const projectRoot = computed(() => workbench.getProject(props.tab.projectId)?.rootPath ?? null)

const loadStatus = async (): Promise<void> => {
  const root = projectRoot.value
  if (!root) {
    entries.value = []
    branch.value = null
    return
  }

  loading.value = true
  error.value = null
  try {
    const result = await gitStatus(root)
    branch.value = result.branch
    entries.value = (result.entries as GitStatusEntry[]) ?? []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load git status'
    entries.value = []
    branch.value = null
  } finally {
    loading.value = false
  }
}

const formatStatus = (entry: GitStatusEntry): string => {
  if (entry.isUntracked) {
    return '??'
  }
  const staged = entry.stagedStatus ?? ' '
  const unstaged = entry.unstagedStatus ?? ' '
  return `${staged}${unstaged}`
}

const handleOpenDiff = (path: string): void => {
  workbench.openEditor(props.tab.projectId, path)
}

onMounted(() => {
  loadStatus().catch((err) => {
    toast.error('Failed to load changes', {
      description: err instanceof Error ? err.message : 'Unknown error',
    })
  })
})

watch(projectRoot, () => {
  loadStatus().catch((err) => {
    toast.error('Failed to load changes', {
      description: err instanceof Error ? err.message : 'Unknown error',
    })
  })
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-y-auto p-4 text-sm">
    <div class="mb-4 flex items-center justify-between gap-2">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Local</p>
        <p class="font-medium">{{ branch ?? 'No branch' }}</p>
      </div>
    </div>

    <p v-if="loading" class="text-muted-foreground">Loading git status…</p>
    <p v-else-if="error" class="text-destructive">{{ error }}</p>
    <p v-else-if="entries.length === 0" class="text-muted-foreground">No uncommitted changes</p>

    <ul v-else class="space-y-1">
      <li
        v-for="entry in entries"
        :key="entry.path"
        class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-accent/50"
        @click="handleOpenDiff(entry.path)"
      >
        <span class="w-6 shrink-0 font-mono text-xs text-muted-foreground">
          {{ formatStatus(entry) }}
        </span>
        <span class="truncate">{{ entry.path }}</span>
      </li>
    </ul>
  </div>
</template>
