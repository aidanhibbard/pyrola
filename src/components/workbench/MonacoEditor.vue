<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { listen } from '@tauri-apps/api/event'
import { toast } from 'vue-sonner'
import * as monaco from 'monaco-editor'
import {
  fsReadFile,
  fsWriteFile,
  isTauri,
  lspEnsureServer,
  lspRequest,
} from '@/services/pyrola/pyrola-tauri'
import useWorkbenchStore from '@/composables/use-workbench-store'
import {
  fileExtension,
  LSP_MARKER_OWNER,
  lspDiagnosticsToMarkers,
  normalizeFileUri,
  parseLspCompletionItems,
  parseLspDiagnostics,
  parseLspHoverContents,
  parseLspLocations,
  workspacePathToFileUri,
} from '@/utils/monaco-lsp'
import { detectMonacoLanguage } from '@/utils/monaco-language'
import { ensureMonacoLanguage, ensureMonacoShiki } from '@/utils/monaco-shiki'
import {
  applyMonacoTheme,
  ensureMonacoBaseThemes,
  observeMonacoTheme,
  resolveMonacoEditorOptions,
} from '@/utils/monaco-theme'

type LspDiagnosticsEvent = {
  uri: string
  diagnostics: unknown
  serverId: string
}

const props = defineProps<{
  projectId: string
  path: string | null
  openPaths?: string[]
  lspEnabled?: boolean
  lineNumbers?: boolean
  wordWrap?: boolean
  diffView?: boolean
}>()

const emit = defineEmits<{
  'dirty-change': [payload: { path: string; dirty: boolean }]
  saved: [payload: { path: string; content: string }]
}>()

const workbench = useWorkbenchStore()
const containerRef = ref<HTMLDivElement | null>(null)
const saving = ref(false)

let editor: monaco.editor.IStandaloneCodeEditor | null = null
let editorInitializing = false
let resizeObserver: ResizeObserver | null = null
let contentChangeDisposable: monaco.IDisposable | null = null
let lspProviderDisposables: monaco.IDisposable[] = []
let unlistenDiagnostics: (() => void) | null = null
let stopThemeObserver: (() => void) | null = null
let lspProvidersRegistered = false
const models = new Map<string, monaco.editor.ITextModel>()
const pathByModel = new Map<monaco.editor.ITextModel, string>()
const lspServerByPath = new Map<string, string>()
const dirtyByPath = new Map<string, boolean>()

const lspActive = computed(() => props.lspEnabled !== false && isTauri())

const lineNumbersOption = computed((): 'on' | 'off' =>
  props.lineNumbers !== false ? 'on' : 'off',
)

const wordWrapOption = computed((): 'on' | 'off' =>
  props.wordWrap === true ? 'on' : 'off',
)

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Unknown error'
}

const layoutEditor = (): void => {
  editor?.layout()
}

const hasEditorDimensions = (element: HTMLElement): boolean =>
  element.clientWidth > 0 && element.clientHeight > 0

const initializeEditor = async (): Promise<boolean> => {
  if (!containerRef.value || editor || editorInitializing) {
    return editor !== null
  }

  if (!hasEditorDimensions(containerRef.value)) {
    return false
  }

  editorInitializing = true
  try {
    ensureMonacoBaseThemes(monaco)
    applyMonacoTheme(monaco)

    stopThemeObserver?.()
    stopThemeObserver = observeMonacoTheme(monaco, layoutEditor)

    // Silence Monaco's built-in TypeScript worker diagnostics. The bundled
    // tsserver worker does not understand Vue SFC or Vite CSS module imports,
    // so it produces false positives (e.g. "Cannot find module './App.vue'")
    // that Cursor/Volar do not show. Accurate diagnostics come from the
    // external LSP (Volar) when `lsp.enabled` is on.
    const tsLang = monaco.languages.typescript as unknown as {
      typescriptDefaults: { setDiagnosticsOptions(opts: { noSemanticValidation: boolean; noSyntaxValidation: boolean }): void }
      javascriptDefaults: { setDiagnosticsOptions(opts: { noSemanticValidation: boolean; noSyntaxValidation: boolean }): void }
    }
    tsLang.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    })
    tsLang.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    })

    // Create the editor synchronously first so opening a file never waits on
    // Shiki and cannot race setModel against a null editor.
    const created = monaco.editor.create(containerRef.value, {
      ...resolveMonacoEditorOptions(),
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      lineNumbers: lineNumbersOption.value,
      wordWrap: wordWrapOption.value,
    })
    editor = created

    created.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      save().catch((error) => {
        toast.error('Failed to save file', {
          description: formatError(error),
        })
      })
    })

    if (props.path) {
      await attachModel(props.path)
    }

    if (editor !== created) {
      return false
    }

    try {
      await ensureMonacoShiki(monaco)
      if (editor === created) {
        applyMonacoTheme(monaco)
      }
    } catch (error) {
      toast.error('Syntax highlighting unavailable', {
        description: formatError(error),
      })
    }

    return editor === created
  } catch (error) {
    toast.error('Failed to initialize editor', {
      description: formatError(error),
    })
    return false
  } finally {
    editorInitializing = false
  }
}

const tryInitializeEditor = (): void => {
  initializeEditor().catch((error) => {
    toast.error('Failed to initialize editor', {
      description: formatError(error),
    })
  })
}

const syncEditorViewOptions = (): void => {
  editor?.updateOptions({
    lineNumbers: lineNumbersOption.value,
    wordWrap: wordWrapOption.value,
  })
}

const projectRoot = computed(
  () => workbench.getProject(props.projectId)?.rootPath ?? null,
)

const setPathDirty = (path: string, dirty: boolean): void => {
  const wasDirty = dirtyByPath.get(path) ?? false
  if (wasDirty === dirty) {
    return
  }
  dirtyByPath.set(path, dirty)
  emit('dirty-change', { path, dirty })
}

const isPathDirty = (path: string): boolean => dirtyByPath.get(path) ?? false

const clearLspMarkers = (model: monaco.editor.ITextModel): void => {
  monaco.editor.setModelMarkers(model, LSP_MARKER_OWNER, [])
}

const getLspServerId = (path: string): string | null => lspServerByPath.get(path) ?? null

const syncDocumentToLsp = async (path: string, content: string): Promise<void> => {
  const serverId = getLspServerId(path)
  if (!lspActive.value || !serverId) {
    return
  }

  await lspRequest(serverId, 'textDocument/didChange', { path, content })
}

const applyDiagnostics = (
  model: monaco.editor.ITextModel,
  result: unknown,
): void => {
  const diagnostics = parseLspDiagnostics(result)
  const markers = lspDiagnosticsToMarkers(diagnostics, monaco)
  monaco.editor.setModelMarkers(model, LSP_MARKER_OWNER, markers)
}

const findModelForFileUri = (uri: string): monaco.editor.ITextModel | null => {
  const root = projectRoot.value
  if (!root) {
    return null
  }

  const targetPath = normalizeFileUri(uri)
  for (const [path, model] of models.entries()) {
    const modelPath = normalizeFileUri(workspacePathToFileUri(root, path))
    if (modelPath === targetPath) {
      return model
    }
  }

  return null
}

const handlePushDiagnostics = (payload: LspDiagnosticsEvent): void => {
  if (!lspActive.value) {
    return
  }

  const model = findModelForFileUri(payload.uri)
  if (!model) {
    return
  }

  const path = pathByModel.get(model)
  const serverId = path ? getLspServerId(path) : null
  if (!serverId || serverId !== payload.serverId) {
    return
  }

  applyDiagnostics(model, { diagnostics: payload.diagnostics })
}

const refreshDiagnostics = async (
  path: string,
  model: monaco.editor.ITextModel,
): Promise<void> => {
  const serverId = getLspServerId(path)
  if (!lspActive.value || !serverId) {
    return
  }

  try {
    await syncDocumentToLsp(path, model.getValue())
    const result = await lspRequest(serverId, 'diagnostics', {
      path,
      content: model.getValue(),
    })
    applyDiagnostics(model, result)
  } catch {
    clearLspMarkers(model)
  }
}

const debouncedRefreshDiagnostics = useDebounceFn(
  (path: string, model: monaco.editor.ITextModel) => {
    refreshDiagnostics(path, model).catch(() => {
      clearLspMarkers(model)
    })
  },
  500,
)

const closeLspDocument = async (path: string): Promise<void> => {
  const serverId = lspServerByPath.get(path)
  if (!serverId) {
    return
  }

  try {
    await lspRequest(serverId, 'textDocument/didClose', { path })
  } finally {
    lspServerByPath.delete(path)
  }
}

const teardownLspForPath = async (path: string, model: monaco.editor.ITextModel): Promise<void> => {
  clearLspMarkers(model)
  await closeLspDocument(path)
}

const setupLspForPath = async (
  path: string,
  model: monaco.editor.ITextModel,
): Promise<void> => {
  if (!lspActive.value) {
    clearLspMarkers(model)
    return
  }

  const extension = fileExtension(path)
  if (!extension) {
    return
  }

  try {
    const root = projectRoot.value
    if (!root) {
      clearLspMarkers(model)
      return
    }

    const server = await lspEnsureServer(extension, root)
    if (!server.running) {
      lspServerByPath.delete(path)
      clearLspMarkers(model)
      if (extension === 'java' || extension === '.java') {
        toast.error('Java language server unavailable', {
          description:
            'Install a JDK on PATH, or enable lsp.autoDownload so jdtls can be fetched.',
        })
      }
      return
    }

    lspServerByPath.set(path, server.id)
    await lspRequest(server.id, 'textDocument/didOpen', {
      path,
      content: model.getValue(),
    })
    await refreshDiagnostics(path, model)
  } catch (error) {
    lspServerByPath.delete(path)
    clearLspMarkers(model)
    const message = formatError(error)
    if (
      extension === 'java' ||
      extension === '.java' ||
      message.toLowerCase().includes('jdk') ||
      message.toLowerCase().includes('jdtls')
    ) {
      toast.error('Java language server failed', {
        description: message,
      })
    }
  }
}

const resolvePathForModel = (model: monaco.editor.ITextModel): string | null =>
  pathByModel.get(model) ?? null

const registerLspProviders = (): void => {
  if (lspProvidersRegistered) {
    return
  }
  lspProvidersRegistered = true

  lspProviderDisposables.push(
    monaco.languages.registerHoverProvider('*', {
      provideHover: async (model, position) => {
        if (!lspActive.value) {
          return null
        }

        const path = resolvePathForModel(model)
        const serverId = path ? getLspServerId(path) : null
        if (!path || !serverId) {
          return null
        }

        try {
          await syncDocumentToLsp(path, model.getValue())
          const result = await lspRequest(serverId, 'hover', {
            path,
            position: {
              line: position.lineNumber - 1,
              character: position.column - 1,
            },
          })

          const contents = parseLspHoverContents(result)
          if (contents.length === 0) {
            return null
          }

          return {
            range: new monaco.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column,
            ),
            contents: contents.map((value) => ({ value })),
          }
        } catch {
          return null
        }
      },
    }),
  )

  lspProviderDisposables.push(
    monaco.languages.registerDefinitionProvider('*', {
      provideDefinition: async (model, position) => {
        if (!lspActive.value) {
          return null
        }

        const path = resolvePathForModel(model)
        const serverId = path ? getLspServerId(path) : null
        if (!path || !serverId) {
          return null
        }

        try {
          await syncDocumentToLsp(path, model.getValue())
          const result = await lspRequest(serverId, 'goToDefinition', {
            path,
            position: {
              line: position.lineNumber - 1,
              character: position.column - 1,
            },
          })

          const locations = parseLspLocations(result)
          if (locations.length === 0) {
            return null
          }

          return locations.map((location) => ({
            uri: monaco.Uri.parse(location.uri),
            range: new monaco.Range(
              location.range.start.line + 1,
              location.range.start.character + 1,
              location.range.end.line + 1,
              location.range.end.character + 1,
            ),
          }))
        } catch {
          return null
        }
      },
    }),
  )

  lspProviderDisposables.push(
    monaco.languages.registerCompletionItemProvider('*', {
      triggerCharacters: ['.', '"', "'", '/', '<', ':'],
      provideCompletionItems: async (model, position) => {
        if (!lspActive.value) {
          return { suggestions: [] }
        }

        const path = resolvePathForModel(model)
        const serverId = path ? getLspServerId(path) : null
        if (!path || !serverId) {
          return { suggestions: [] }
        }

        try {
          await syncDocumentToLsp(path, model.getValue())
          const result = await lspRequest(serverId, 'textDocument/completion', {
            path,
            position: {
              line: position.lineNumber - 1,
              character: position.column - 1,
            },
          })

          return {
            suggestions: parseLspCompletionItems(result, monaco),
          }
        } catch {
          return { suggestions: [] }
        }
      },
    }),
  )
}

const getOrCreateModel = async (path: string): Promise<monaco.editor.ITextModel> => {
  const existing = models.get(path)
  if (existing) {
    return existing
  }

  const root = projectRoot.value
  if (!root) {
    throw new Error('Project not found')
  }

  const result = await fsReadFile({ projectRoot: root, path })
  const languageId = detectMonacoLanguage(path)
  if (
    languageId !== 'plaintext' &&
    !monaco.languages.getLanguages().some((language) => language.id === languageId)
  ) {
    monaco.languages.register({ id: languageId })
  }
  const model = monaco.editor.createModel(result.content, languageId)
  models.set(path, model)
  pathByModel.set(model, path)

  // Upgrade highlighting in the background; do not block showing file contents.
  ensureMonacoLanguage(monaco, languageId).catch(() => {
    // Highlighting is best-effort; the model already has content.
  })

  return model
}

const attachModel = async (path: string): Promise<void> => {
  const activeEditor = editor
  if (!activeEditor) {
    return
  }

  contentChangeDisposable?.dispose()
  contentChangeDisposable = null

  const model = await getOrCreateModel(path)
  if (editor !== activeEditor) {
    return
  }

  activeEditor.setModel(model)

  contentChangeDisposable = model.onDidChangeContent(() => {
    setPathDirty(path, true)
    if (lspActive.value) {
      debouncedRefreshDiagnostics(path, model)
    }
  })

  await setupLspForPath(path, model)

  emit('dirty-change', { path, dirty: isPathDirty(path) })
  layoutEditor()
}

const disposeModel = (path: string): void => {
  const model = models.get(path)
  if (!model) {
    return
  }

  teardownLspForPath(path, model).catch(() => {
    clearLspMarkers(model)
    lspServerByPath.delete(path)
  })

  if (editor?.getModel() === model) {
    editor.setModel(null)
  }

  pathByModel.delete(model)
  model.dispose()
  models.delete(path)
  dirtyByPath.delete(path)
}

const syncOpenModels = (openPaths: string[]): void => {
  for (const path of models.keys()) {
    if (!openPaths.includes(path)) {
      disposeModel(path)
    }
  }
}

const save = async (targetPath?: string): Promise<boolean> => {
  const root = projectRoot.value
  const path = targetPath ?? props.path
  if (!root || !path || !editor || saving.value) {
    return false
  }

  if (editor.getModel() !== models.get(path)) {
    await attachModel(path)
  }

  const model = editor.getModel()
  if (!model) {
    return false
  }

  saving.value = true
  try {
    const content = model.getValue()
    await fsWriteFile({ projectRoot: root, path, content })
    setPathDirty(path, false)
    emit('saved', { path, content })
    if (lspActive.value) {
      await refreshDiagnostics(path, model)
    }
    toast.success('Saved')
    return true
  } catch (error) {
    toast.error('Failed to save file', {
      description: formatError(error),
    })
    return false
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (!containerRef.value) {
    return
  }

  registerLspProviders()

  if (isTauri()) {
    listen<LspDiagnosticsEvent>('lsp://diagnostics', (event) => {
      handlePushDiagnostics(event.payload)
    })
      .then((unlisten) => {
        unlistenDiagnostics = unlisten
      })
      .catch((error) => {
        toast.error('Failed to subscribe to LSP diagnostics', {
          description: formatError(error),
        })
      })
  }

  tryInitializeEditor()

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (!editor) {
        tryInitializeEditor()
        return
      }
      layoutEditor()
    })
    resizeObserver.observe(containerRef.value)
  }
})

watch(
  () => props.path,
  (path, previousPath) => {
    if (!path || path === previousPath) {
      return
    }
    attachModel(path).catch((error) => {
      toast.error('Failed to load file', {
        description: formatError(error),
      })
    })
  },
)

watch(
  () => props.openPaths,
  (openPaths) => {
    if (!openPaths) {
      return
    }
    syncOpenModels(openPaths)
  },
  { deep: true },
)

watch([lineNumbersOption, wordWrapOption], () => {
  syncEditorViewOptions()
})

watch(lspActive, async (enabled) => {
  const path = props.path
  const model = path ? models.get(path) : null
  if (!path || !model) {
    return
  }

  if (enabled) {
    await setupLspForPath(path, model)
    return
  }

  await teardownLspForPath(path, model)
})

onBeforeUnmount(() => {
  contentChangeDisposable?.dispose()
  contentChangeDisposable = null

  unlistenDiagnostics?.()
  unlistenDiagnostics = null

  stopThemeObserver?.()
  stopThemeObserver = null

  for (const disposable of lspProviderDisposables) {
    disposable.dispose()
  }
  lspProviderDisposables = []
  lspProvidersRegistered = false

  for (const [path, model] of models.entries()) {
    clearLspMarkers(model)
    closeLspDocument(path).catch(() => {
      lspServerByPath.delete(path)
    })
    pathByModel.delete(model)
    model.dispose()
  }

  models.clear()
  lspServerByPath.clear()
  dirtyByPath.clear()
  resizeObserver?.disconnect()
  resizeObserver = null
  editor?.dispose()
  editor = null
})

defineExpose({
  save,
  isPathDirty,
})
</script>

<template>
  <div
    ref="containerRef"
    class="h-full min-h-0 w-full overflow-hidden"
  />
</template>
