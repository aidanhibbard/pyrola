<script setup lang="ts">
import '@xterm/xterm/css/xterm.css'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { toast } from 'vue-sonner'
import {
  shellKillPty,
  shellResizePty,
  shellSpawnPty,
  shellWritePty,
} from '@/services/pyrola/pyrola-tauri'
import useWorkbenchStore from '@/composables/use-workbench-store'
import type { TerminalPayload, WorkbenchTab } from '@/types/workbench/workbench-tab'

const props = defineProps<{
  tab: WorkbenchTab
}>()

const workbench = useWorkbenchStore()
const containerRef = ref<HTMLDivElement | null>(null)

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let sessionId: string | null = null
let unlisten: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null
let ptyErrorShown = false

const notifyPtyError = (title: string, error: unknown): void => {
  if (ptyErrorShown) {
    return
  }
  ptyErrorShown = true
  toast.error(title, {
    description: error instanceof Error ? error.message : 'Unknown error',
  })
}

const initTerminal = async (): Promise<void> => {
  const project = workbench.getProject(props.tab.projectId)
  const root = project?.rootPath
  if (!containerRef.value || !root) {
    return
  }

  terminal = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    theme: {
      background: 'transparent',
    },
  })
  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(containerRef.value)
  fitAddon.fit()

  const payload = props.tab.payload as TerminalPayload
  const { sessionId: id } = await shellSpawnPty({
    projectRoot: root,
    cols: terminal.cols,
    rows: terminal.rows,
    cwd: payload.cwd ?? undefined,
  })
  sessionId = id
  workbench.registerTerminalSession(props.tab.id, id)

  unlisten = await listen<string>(`pty-output-${id}`, (event) => {
    terminal?.write(event.payload)
  })

  terminal.onData((data) => {
    if (sessionId) {
      shellWritePty(sessionId, data).catch((error) => {
        notifyPtyError('Terminal input failed', error)
      })
    }
  })

  resizeObserver = new ResizeObserver(() => {
    fitAddon?.fit()
    if (terminal && sessionId) {
      shellResizePty(sessionId, terminal.cols, terminal.rows).catch((error) => {
        notifyPtyError('Terminal resize failed', error)
      })
    }
  })
  resizeObserver.observe(containerRef.value)
}

onMounted(() => {
  initTerminal().catch((error) => {
    toast.error('Failed to start terminal', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
})

onBeforeUnmount(() => {
  workbench.unregisterTerminalSession(props.tab.id)
  if (unlisten) {
    unlisten()
  }
  if (sessionId) {
    shellKillPty(sessionId).catch((error) => {
      notifyPtyError('Failed to close terminal', error)
    })
  }
  resizeObserver?.disconnect()
  terminal?.dispose()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-black/90">
    <div ref="containerRef" class="min-h-0 flex-1 p-1" />
  </div>
</template>
