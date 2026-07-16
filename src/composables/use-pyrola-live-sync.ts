import { onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { toast } from 'vue-sonner'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import useMcpServers from '@/composables/use-mcp-servers'
import useFleetRegistry from '@/composables/use-fleet-registry'
import { watchPyrolaPaths } from '@/services/pyrola/pyrola-tauri'

export type PyrolaFileKind = 'settings' | 'mcp' | 'agents' | 'rules' | 'skills' | 'plans' | 'studio'

export type PyrolaFileChange = {
  scope: 'personal' | 'project'
  rootPath?: string | null
  kind: PyrolaFileKind
}

export const pyrolaFileChangeToken = ref(0)
export const lastPyrolaFileChange = shallowRef<PyrolaFileChange | null>(null)

export default () => {
  const config = usePyrolaConfig()
  const mcp = useMcpServers()
  const fleet = useFleetRegistry()

  let unlisten: UnlistenFn | null = null

  const syncWatcher = async (): Promise<void> => {
    await watchPyrolaPaths(config.activeRootPath.value)
  }

  const applyChange = async (change: PyrolaFileChange): Promise<void> => {
    lastPyrolaFileChange.value = change
    pyrolaFileChangeToken.value += 1

    if (change.kind === 'settings') {
      await config.refreshAll()
      return
    }

    if (change.kind === 'mcp') {
      await mcp.loadConfigs(config.activeRootPath.value)
      await mcp.refreshStates()
    }
  }

  const handleFileChanged = async (change: PyrolaFileChange): Promise<void> => {
    try {
      await applyChange(change)
    } catch (error) {
      toast.error('Failed to sync file change', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  onMounted(async () => {
    await fleet.refresh()
    await fleet.ensureDefaultProject()
    await config.refreshAll()
    await mcp.loadConfigs(config.activeRootPath.value)
    await mcp.refreshStates()
    await syncWatcher()

    unlisten = await listen<PyrolaFileChange>('pyrola-file-changed', (event) => {
      const change = event.payload
      if (
        change.scope === 'project' &&
        change.rootPath &&
        change.rootPath !== config.activeRootPath.value
      ) {
        return
      }
      handleFileChanged(change)
    })
  })

  watch(
    () => config.activeRootPath.value,
    async (rootPath) => {
      await config.refreshAll()
      await mcp.loadConfigs(rootPath)
      await mcp.refreshStates()
      await syncWatcher()
    },
  )

  onUnmounted(() => {
    unlisten?.()
    unlisten = null
  })

  return {
    syncWatcher,
    applyChange,
  }
}
