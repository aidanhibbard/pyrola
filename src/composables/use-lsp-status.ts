import { computed, onMounted, ref, watch } from 'vue'
import { listen } from '@tauri-apps/api/event'
import type {
  LspHealth,
  LspProblemItem,
  LspServerDisplayState,
  LspStatusServerRow,
} from '@/types/lsp/lsp-status'
import useFleetRegistry from '@/composables/use-fleet-registry'
import {
  isTauri,
  lspCatalog,
  lspEnsureServer,
  type LspCatalogEntry,
} from '@/services/pyrola/pyrola-tauri'
import {
  normalizeFileUri,
  parseLspDiagnostics,
  type LspDiagnostic,
} from '@/utils/monaco-lsp'

type LspInstallProgress = {
  serverId: string
  state: string
  message?: string | null
}

type LspDiagnosticsEvent = {
  uri: string
  diagnostics: unknown
  serverId: string
}

const servers = ref<LspCatalogEntry[]>([])
const installMessage = ref<string | null>(null)
const prefetchBusy = ref(false)
const warming = ref(false)
const diagnosticsByUri = ref<Map<string, LspDiagnostic[]>>(new Map())
const awaitingProjectLoad = ref<Set<string>>(new Set())

let listenersBound = false
let unlistenInstall: (() => void) | null = null
let unlistenDiagnostics: (() => void) | null = null
let lastWarmedRoot: string | null = null
let awaitingClearTimer: ReturnType<typeof setTimeout> | null = null

const scheduleAwaitingClear = (): void => {
  if (awaitingClearTimer !== null) {
    clearTimeout(awaitingClearTimer)
  }
  awaitingClearTimer = setTimeout(() => {
    awaitingProjectLoad.value = new Set()
    awaitingClearTimer = null
  }, 20_000)
}

const resolveDisplayState = (entry: LspCatalogEntry): LspServerDisplayState => {
  if (entry.disabled) {
    return 'disabled'
  }
  if (entry.installState === 'needs_trust') {
    return 'needs_trust'
  }
  if (entry.error) {
    return 'error'
  }
  // Prefer live process state over a stale "installing" flag left in LSP_STATES.
  if (entry.running) {
    return 'running'
  }
  if (entry.installState === 'starting') {
    return 'starting'
  }
  // Packages already on disk but ensure/start still in flight should read as
  // starting, not installing (install events cover real downloads).
  if (entry.installState === 'installing') {
    return entry.installed ? 'starting' : 'installing'
  }
  if (entry.installState === 'ready' || entry.installed) {
    return 'stopped'
  }
  return 'missing'
}

const toStatusRow = (entry: LspCatalogEntry): LspStatusServerRow => ({
  id: entry.id,
  label: entry.label,
  extensions: entry.extensions,
  running: entry.running,
  installed: entry.installed,
  disabled: entry.disabled,
  requiresTrust: entry.requiresTrust,
  error: entry.error ?? null,
  source: entry.source ?? null,
  installState: entry.installState ?? null,
  displayState: resolveDisplayState(entry),
})

const countSeverity = (severity: number): number => {
  let total = 0
  for (const diagnostics of diagnosticsByUri.value.values()) {
    for (const diagnostic of diagnostics) {
      if (diagnostic.severity === severity) {
        total += 1
      }
    }
  }
  return total
}

const fileUriToProjectPath = (uri: string, projectRoot: string): string | null => {
  const absolute = normalizeFileUri(uri).replace(/\\/g, '/')
  const root = projectRoot.replace(/\\/g, '/').replace(/\/$/, '')
  if (absolute === root) {
    return '.'
  }
  const prefix = `${root}/`
  if (absolute.startsWith(prefix)) {
    return absolute.slice(prefix.length)
  }
  return null
}

export default () => {
  const fleet = useFleetRegistry()
  const projectRoot = computed(() => fleet.activeProject.value?.rootPath ?? null)

  const refreshCatalog = async (): Promise<void> => {
    if (!isTauri()) {
      return
    }
    try {
      servers.value = await lspCatalog()
    } catch (error) {
      installMessage.value =
        error instanceof Error ? error.message : 'Failed to load language servers'
    }
  }

  const markAwaitingProjectLoad = (serverId: string): void => {
    const next = new Set(awaitingProjectLoad.value)
    next.add(serverId)
    awaitingProjectLoad.value = next
    scheduleAwaitingClear()
  }

  const clearDiagnostics = (): void => {
    diagnosticsByUri.value = new Map()
  }

  const warmDefaults = async (root: string, force = false): Promise<void> => {
    if (!isTauri() || warming.value) {
      return
    }
    if (!force && lastWarmedRoot === root) {
      const vue = servers.value.find((entry) => entry.id === 'vue')
      const typescript = servers.value.find((entry) => entry.id === 'typescript')
      if (vue?.running && typescript?.running) {
        return
      }
    }
    warming.value = true
    installMessage.value = 'Starting language servers'
    awaitingProjectLoad.value = new Set(['vue', 'typescript'])
    scheduleAwaitingClear()
    try {
      await Promise.all([
        lspEnsureServer('vue', root),
        lspEnsureServer('ts', root),
      ])
      lastWarmedRoot = root
    } catch (error) {
      installMessage.value =
        error instanceof Error ? error.message : 'Failed to start language servers'
      awaitingProjectLoad.value = new Set()
    } finally {
      warming.value = false
      await refreshCatalog()
    }
  }

  const statusRows = computed((): LspStatusServerRow[] =>
    servers.value.map(toStatusRow),
  )

  const visibleRows = computed((): LspStatusServerRow[] => {
    const busy = prefetchBusy.value || warming.value
    return statusRows.value.filter((row) => {
      if (
        row.running ||
        row.displayState === 'installing' ||
        row.displayState === 'starting' ||
        row.displayState === 'needs_trust' ||
        row.displayState === 'error'
      ) {
        return true
      }
      if (busy && (row.id === 'vue' || row.id === 'typescript')) {
        return true
      }
      return false
    })
  })

  const errorCount = computed(() => countSeverity(1))
  const warningCount = computed(() => countSeverity(2))

  const hasServerErrors = computed(() =>
    statusRows.value.some((row) => row.displayState === 'error' || Boolean(row.error)),
  )

  const isBusy = computed(
    () =>
      prefetchBusy.value ||
      warming.value ||
      awaitingProjectLoad.value.size > 0 ||
      statusRows.value.some(
        (row) => row.displayState === 'installing' || row.displayState === 'starting',
      ),
  )

  const health = computed((): LspHealth => {
    if (isBusy.value) {
      return 'busy'
    }
    if (hasServerErrors.value || errorCount.value > 0) {
      return 'error'
    }
    if (warningCount.value > 0) {
      return 'warning'
    }
    return 'ok'
  })

  const problems = computed((): LspProblemItem[] => {
    const root = projectRoot.value
    const items: LspProblemItem[] = []
    for (const [uri, diagnostics] of diagnosticsByUri.value.entries()) {
      const path = root ? fileUriToProjectPath(uri, root) : null
      const displayPath = path ?? normalizeFileUri(uri)
      for (const [index, diagnostic] of diagnostics.entries()) {
        if (diagnostic.severity !== 1 && diagnostic.severity !== 2) {
          continue
        }
        const line = (diagnostic.range?.start.line ?? 0) + 1
        const character = (diagnostic.range?.start.character ?? 0) + 1
        items.push({
          id: `${uri}:${index}:${line}:${character}`,
          uri,
          path: displayPath,
          message: diagnostic.message,
          severity: diagnostic.severity === 1 ? 'error' : 'warning',
          line,
          character,
        })
      }
    }
    return items.sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === 'error' ? -1 : 1
      }
      const byPath = left.path.localeCompare(right.path)
      if (byPath !== 0) {
        return byPath
      }
      return left.line - right.line
    })
  })

  const tooltipSummary = computed((): string => {
    if (isBusy.value) {
      return installMessage.value?.trim() || 'Starting language servers'
    }
    if (errorCount.value > 0 || warningCount.value > 0) {
      const parts: string[] = []
      if (errorCount.value > 0) {
        parts.push(`${errorCount.value} error${errorCount.value === 1 ? '' : 's'}`)
      }
      if (warningCount.value > 0) {
        parts.push(`${warningCount.value} warning${warningCount.value === 1 ? '' : 's'}`)
      }
      return parts.join(', ')
    }
    if (hasServerErrors.value) {
      return 'Language server error'
    }
    return 'Language servers healthy'
  })

  const bindListeners = async (): Promise<void> => {
    if (!isTauri() || listenersBound) {
      return
    }
    listenersBound = true

    try {
      unlistenInstall = await listen<LspInstallProgress>('lsp://install', (event) => {
        const { serverId, state, message } = event.payload
        installMessage.value = message ?? `${serverId}: ${state}`

        if (state === 'installing' && serverId === '*') {
          prefetchBusy.value = true
        }

        if (state === 'installing' && serverId !== '*') {
          servers.value = servers.value.map((entry) =>
            entry.id === serverId
              ? { ...entry, installState: 'installing', error: null }
              : entry,
          )
        }

        if (state === 'ready' || state === 'error') {
          if (serverId === '*') {
            prefetchBusy.value = false
          }
          if (serverId !== '*') {
            servers.value = servers.value.map((entry) => {
              if (entry.id !== serverId) {
                return entry
              }
              if (state === 'ready') {
                return {
                  ...entry,
                  installed: true,
                  installState: entry.running ? 'ready' : 'starting',
                  error: null,
                }
              }
              return {
                ...entry,
                installState: 'error',
                error: message ?? entry.error ?? 'Install failed',
              }
            })
          }
          refreshCatalog()
            .then(() => {
              if (state === 'ready' && serverId === '*' && projectRoot.value) {
                return warmDefaults(projectRoot.value)
              }
              return undefined
            })
            .catch((error: unknown) => {
              installMessage.value =
                error instanceof Error ? error.message : 'Failed to refresh language servers'
            })
        }
      })
    } catch (error) {
      listenersBound = false
      throw error
    }

    try {
      unlistenDiagnostics = await listen<LspDiagnosticsEvent>('lsp://diagnostics', (event) => {
        const parsed = parseLspDiagnostics({
          diagnostics: event.payload.diagnostics,
        })
        const next = new Map(diagnosticsByUri.value)
        if (parsed.length === 0) {
          next.delete(event.payload.uri)
        } else {
          next.set(event.payload.uri, parsed)
        }
        diagnosticsByUri.value = next

        if (awaitingProjectLoad.value.has(event.payload.serverId)) {
          const remaining = new Set(awaitingProjectLoad.value)
          remaining.delete(event.payload.serverId)
          awaitingProjectLoad.value = remaining
          if (remaining.size === 0) {
            installMessage.value = 'Language servers ready'
          }
        }
      })
    } catch (error) {
      installMessage.value =
        error instanceof Error ? error.message : 'Failed to subscribe to LSP diagnostics'
    }
  }

  const unbindListeners = (): void => {
    unlistenInstall?.()
    unlistenInstall = null
    unlistenDiagnostics?.()
    unlistenDiagnostics = null
    listenersBound = false
  }

  watch(projectRoot, (root, previous) => {
    if (root !== previous) {
      clearDiagnostics()
      lastWarmedRoot = null
      awaitingProjectLoad.value = new Set()
    }
    if (!root) {
      servers.value = []
      return
    }
    refreshCatalog()
      .then(async () => {
        if (root !== projectRoot.value) {
          return
        }
        const vue = servers.value.find((entry) => entry.id === 'vue')
        const typescript = servers.value.find((entry) => entry.id === 'typescript')
        const needsWarm =
          (Boolean(vue?.installed) && !vue?.running) ||
          (Boolean(typescript?.installed) && !typescript?.running)
        if (needsWarm) {
          await warmDefaults(root)
        }
      })
      .catch((error: unknown) => {
        installMessage.value =
          error instanceof Error ? error.message : 'Failed to load language servers'
      })
  })

  onMounted(() => {
    const start = async (): Promise<void> => {
      await bindListeners()
      await refreshCatalog()
      const root = projectRoot.value
      if (!root) {
        return
      }
      const vue = servers.value.find((entry) => entry.id === 'vue')
      const typescript = servers.value.find((entry) => entry.id === 'typescript')
      const needsWarm =
        (Boolean(vue?.installed) && !vue?.running) ||
        (Boolean(typescript?.installed) && !typescript?.running)
      if (needsWarm) {
        await warmDefaults(root)
      }
    }
    start().catch((error: unknown) => {
      installMessage.value =
        error instanceof Error ? error.message : 'Failed to start language status'
    })
  })

  return {
    servers: statusRows,
    visibleRows,
    problems,
    errorCount,
    warningCount,
    hasServerErrors,
    isBusy,
    health,
    installMessage,
    tooltipSummary,
    projectRoot,
    refreshCatalog,
    warmDefaults,
    markAwaitingProjectLoad,
    clearDiagnostics,
    bindListeners,
    unbindListeners,
    fileUriToProjectPath,
  }
}
