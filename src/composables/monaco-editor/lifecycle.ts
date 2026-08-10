import { onBeforeUnmount, onMounted, watch } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { toast } from 'vue-sonner'
import { fsReadFile, isTauri } from '@/services/pyrola/pyrola-tauri'
import { formatError } from './helpers'
import type { MonacoHelpers } from './helpers'
import type { MonacoLsp } from './lsp'
import type { MonacoModels } from './models'
import type { MonacoEditorInstances } from './editor-instances'
import type { LspDiagnosticsEvent, MonacoEditorContext } from './types'

type LifecycleDeps = {
  helpers: MonacoHelpers
  lsp: MonacoLsp
  models: MonacoModels
  editors: MonacoEditorInstances
  registerLspProviders: () => void
}

export const bindMonacoLifecycle = (ctx: MonacoEditorContext, deps: LifecycleDeps): void => {
  onMounted(() => {
    if (!ctx.containerRef.value) {
      return
    }

    deps.registerLspProviders()

    if (isTauri()) {
      listen<LspDiagnosticsEvent>('lsp://diagnostics', (event) => {
        deps.lsp.handlePushDiagnostics(event.payload)
      })
        .then((unlisten) => {
          ctx.unlistenDiagnostics = unlisten
        })
        .catch((error) => {
          toast.error('Failed to subscribe to LSP diagnostics', {
            description: formatError(error),
          })
        })
    }

    deps.editors.tryInitializeEditor()

    if (typeof ResizeObserver !== 'undefined') {
      ctx.resizeObserver = new ResizeObserver(() => {
        if (!deps.helpers.hasActiveEditor()) {
          deps.editors.tryInitializeEditor()
          return
        }
        deps.helpers.layoutEditor()
      })
      ctx.resizeObserver.observe(ctx.containerRef.value)
    }
  })

  watch(
    () => ctx.props.diffView === true,
    (enabled) => {
      const switchView = enabled
        ? deps.editors.switchToDiffView
        : deps.editors.switchToCodeView
      switchView().catch((error) => {
        toast.error(enabled ? 'Failed to open diff view' : 'Failed to open editor', {
          description: formatError(error),
        })
      })
    },
  )

  watch(
    () => ctx.props.path,
    (path, previousPath) => {
      if (!path || path === previousPath) {
        return
      }
      if (ctx.props.diffView) {
        deps.models.attachDiffModels(path).catch((error) => {
          toast.error('Failed to load diff', {
            description: formatError(error),
          })
        })
        return
      }
      deps.models.attachModel(path).catch((error) => {
        toast.error('Failed to load file', {
          description: formatError(error),
        })
      })
    },
  )

  watch(
    () => ctx.workbench.workspaceFileReloadNonce.value,
    async () => {
      const path = ctx.props.path
      if (!path) {
        return
      }
      const paths = ctx.workbench.workspaceFileReloadPaths.value
      if (!paths.includes(path)) {
        return
      }
      const root = ctx.projectRoot.value
      if (!root) {
        return
      }
      try {
        const model = ctx.models.get(path)
        if (!model) {
          return
        }
        const result = await fsReadFile({ projectRoot: root, path })
        if (model.getValue() !== result.content) {
          model.setValue(result.content)
        }
        ctx.dirtyByPath.set(path, false)
        ctx.emit('dirty-change', { path, dirty: false })
      } catch {
        const model = ctx.models.get(path)
        if (model && model.getValue() !== '') {
          model.setValue('')
        }
        ctx.dirtyByPath.set(path, false)
        ctx.emit('dirty-change', { path, dirty: false })
      }
    },
  )

  watch(
    () => ctx.props.openPaths,
    (openPaths) => {
      if (!openPaths) {
        return
      }
      deps.models.syncOpenModels(openPaths)
    },
    { deep: true },
  )

  watch([ctx.lineNumbersOption, ctx.wordWrapOption], () => {
    deps.helpers.syncEditorViewOptions()
  })

  watch(ctx.lspActive, async (enabled) => {
    const path = ctx.props.path
    const model = path ? ctx.models.get(path) : null
    if (!path || !model) {
      return
    }

    if (enabled) {
      await deps.lsp.setupLspForPath(path, model)
      return
    }

    await deps.lsp.teardownLspForPath(path, model)
  })

  onBeforeUnmount(() => {
    ctx.contentChangeDisposable?.dispose()
    ctx.contentChangeDisposable = null

    ctx.unlistenDiagnostics?.()
    ctx.unlistenDiagnostics = null

    ctx.stopThemeObserver?.()
    ctx.stopThemeObserver = null

    for (const disposable of ctx.lspProviderDisposables) {
      disposable.dispose()
    }
    ctx.lspProviderDisposables = []
    ctx.lspProvidersRegistered = false

    for (const [path, model] of ctx.models.entries()) {
      deps.lsp.clearLspMarkers(model)
      deps.lsp.closeLspDocument(path).catch(() => {
        ctx.lspServerByPath.delete(path)
      })
      ctx.pathByModel.delete(model)
      model.dispose()
    }

    ctx.models.clear()
    ctx.lspServerByPath.clear()
    ctx.dirtyByPath.clear()
    ctx.lastLspContentByPath.clear()
    ctx.resizeObserver?.disconnect()
    ctx.resizeObserver = null
    deps.helpers.disposeDiffEditorInstance()
    deps.helpers.disposeOriginalModels()
    deps.helpers.disposeCodeEditor()
  })
}
