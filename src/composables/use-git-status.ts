import {
  onMounted,
  onUnmounted,
  ref,
  watch,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue'
import gitStatus from '@/services/git/git-status'
import type { GitFileDecoration } from '@/types/git/git-file-decoration'
import type { GitStatusEntry } from '@/types/git/git-status-entry'
import buildGitDecorationMaps, {
  decorationClass,
  decorationLabel,
  decorationLetter,
} from '@/utils/git-file-decoration'

export type FileTreeGitDecorationLookups = {
  byPath: Ref<Map<string, GitFileDecoration>>
  folderByPath: Ref<Map<string, GitFileDecoration>>
  ignoredRoots: Ref<string[]>
}

// Symbol.for survives Vite HMR so provide/inject keep matching across reloads.
export const FileTreeGitDecorationKey: InjectionKey<FileTreeGitDecorationLookups> =
  Symbol.for('FileTreeGitDecoration')

const DEBOUNCE_MS = 400

export default (projectRoot: Ref<string | null> | ComputedRef<string | null>) => {
  const entries = ref<GitStatusEntry[]>([])
  const branch = ref<string | null>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)
  const byPath = ref(new Map<string, GitFileDecoration>())
  const folderByPath = ref(new Map<string, GitFileDecoration>())
  const ignoredRoots = ref<string[]>([])

  let refreshGeneration = 0
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const clearState = (): void => {
    entries.value = []
    branch.value = null
    error.value = null
    byPath.value = new Map()
    folderByPath.value = new Map()
    ignoredRoots.value = []
  }

  const refreshNow = async (): Promise<void> => {
    const root = projectRoot.value
    const generation = ++refreshGeneration

    if (!root) {
      clearState()
      pending.value = false
      return
    }

    pending.value = true
    try {
      const result = await gitStatus(root)
      if (generation !== refreshGeneration) {
        return
      }
      entries.value = result.entries
      branch.value = result.branch
      error.value = null
      const maps = buildGitDecorationMaps(result.entries)
      byPath.value = maps.byPath
      folderByPath.value = maps.folderByPath
      ignoredRoots.value = maps.ignoredRoots
    } catch (err) {
      if (generation !== refreshGeneration) {
        return
      }
      clearState()
      error.value = err instanceof Error ? err.message : 'Failed to load git status'
    } finally {
      if (generation === refreshGeneration) {
        pending.value = false
      }
    }
  }

  const refresh = async (): Promise<void> => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    await refreshNow()
  }

  const refreshDebounced = (): void => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      refreshNow().catch((err) => {
        if (!error.value) {
          error.value =
            err instanceof Error ? err.message : 'Failed to load git status'
        }
      })
    }, DEBOUNCE_MS)
  }

  onMounted(() => {
    refreshNow().catch((err) => {
      if (!error.value) {
        error.value =
          err instanceof Error ? err.message : 'Failed to load git status'
      }
    })
  })

  onUnmounted(() => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    refreshGeneration += 1
  })

  watch(projectRoot, () => {
    refreshNow().catch((err) => {
      if (!error.value) {
        error.value =
          err instanceof Error ? err.message : 'Failed to load git status'
      }
    })
  })

  return {
    entries,
    branch,
    pending,
    error,
    byPath,
    folderByPath,
    ignoredRoots,
    decorationClass,
    decorationLetter,
    decorationLabel,
    refresh,
    refreshDebounced,
  }
}
