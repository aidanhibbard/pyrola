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
import useFleetRegistry from '@/composables/use-fleet-registry'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import {
  fileExtension,
  LSP_MARKER_OWNER,
  lspDiagnosticsToMarkers,
  normalizeFileUri,
  parseLspCompletionItems,
  parseLspDiagnostics,
  parseLspHoverContents,
  workspacePathToFileUri,
} from '@/utils/monaco-lsp'
import {
  applyMonacoTheme,
  MONACO_EDITOR_FONT_SIZE_DEFAULT,
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

const LSP_LANGUAGES = [
  'typescript',
  'javascript',
  'rust',
  'python',
  'go',
  'json',
] as const

const fleet = useFleetRegistry()
const config = usePyrolaConfig()
const containerRef = ref<HTMLDivElement | null>(null)
const saving = ref(false)

let editor: monaco.editor.IStandaloneCodeEditor | null = null
let resizeObserver: ResizeObserver | null = null
let contentChangeDisposable: monaco.IDisposable | null = null
let lspProviderDisposables: monaco.IDisposable[] = []
let unlistenDiagnostics: (() => void) | null = null
let stopThemeObserver: (() => void) | null = null
const models = new Map<string, monaco.editor.ITextModel>()
const pathByModel = new Map<monaco.editor.ITextModel, string>()
const lspServerByPath = new Map<string, string>()
const dirtyByPath = new Map<string, boolean>()
const registeredLspLanguages = new Set<string>()

const lspActive = computed(() => props.lspEnabled !== false && isTauri())

const editorFontSize = computed(
  () => config.effectiveSettings.value['appearance.fontSize'] ?? MONACO_EDITOR_FONT_SIZE_DEFAULT,
)

const lineNumbersOption = computed((): 'on' | 'off' =>
  props.lineNumbers !== false ? 'on' : 'off',
)

const wordWrapOption = computed((): 'on' | 'off' =>
  props.wordWrap !== false ? 'on' : 'off',
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

const detectLanguage = (path: string): string => {
  if (path.endsWith('.vue')) {
    return 'html'
  }
  if (path.endsWith('.ts') || path.endsWith('.tsx')) {
    return 'typescript'
  }
  if (path.endsWith('.js') || path.endsWith('.jsx')) {
    return 'javascript'
  }
  if (path.endsWith('.rs')) {
    return 'rust'
  }
  if (path.endsWith('.json')) {
    return 'json'
  }
  if (path.endsWith('.md') || path.endsWith('.markdown')) {
    return 'markdown'
  }
  if (path.endsWith('.css')) {
    return 'css'
  }
  if (path.endsWith('.html')) {
    return 'html'
  }
  if (path.endsWith('.py') || path.endsWith('.pyi')) {
    return 'python'
  }
  if (path.endsWith('.go')) {
    return 'go'
  }
  return 'plaintext'
}

const layoutEditor = (): void => {
  editor?.layout()
}

const hasEditorDimensions = (element: HTMLElement): boolean =>
  element.clientWidth > 0 && element.clientHeight > 0

const initializeEditor = (): boolean => {
  if (!containerRef.value || editor) {
    return editor !== null
  }

  if (!hasEditorDimensions(containerRef.value)) {
    return false
  }

  try {
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

    editor = monaco.editor.create(containerRef.value, {
      ...resolveMonacoEditorOptions(editorFontSize.value),
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      lineNumbers: lineNumbersOption.value,
      wordWrap: wordWrapOption.value,
    })

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      save().catch((error) => {
        toast.error('Failed to save file', {
          description: formatError(error),
        })
      })
    })

    if (props.path) {
      attachModel(props.path).catch((error) => {
        toast.error('Failed to load file', {
          description: formatError(error),
        })
      })
    }

    return true
  } catch (error) {
    toast.error('Failed to initialize editor', {
      description: formatError(error),
    })
    return false
  }
}

const tryInitializeEditor = (): void => {
  initializeEditor()
}

const syncEditorViewOptions = (): void => {
  editor?.updateOptions({
    fontSize: editorFontSize.value,
    lineNumbers: lineNumbersOption.value,
    wordWrap: wordWrapOption.value,
  })
}

const projectRoot = computed(
  () => fleet.projects.value.find((p) => p.id === props.projectId)?.rootPath ?? null,
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
  } catch {
    // Silent no-op when closing documents.
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
      return
    }

    lspServerByPath.set(path, server.id)
    await lspRequest(server.id, 'textDocument/didOpen', {
      path,
      content: model.getValue(),
    })
    await refreshDiagnostics(path, model)
  } catch {
    lspServerByPath.delete(path)
    clearLspMarkers(model)
  }
}

const resolvePathForModel = (model: monaco.editor.ITextModel): string | null =>
  pathByModel.get(model) ?? null

const registerLspProviders = (): void => {
  for (const language of LSP_LANGUAGES) {
    if (registeredLspLanguages.has(language)) {
      continue
    }
    registeredLspLanguages.add(language)

    lspProviderDisposables.push(
      monaco.languages.registerHoverProvider(language, {
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
      monaco.languages.registerCompletionItemProvider(language, {
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
  const model = monaco.editor.createModel(result.content, detectLanguage(path))
  models.set(path, model)
  pathByModel.set(model, path)
  return model
}

const attachModel = async (path: string): Promise<void> => {
  if (!editor) {
    return
  }

  contentChangeDisposable?.dispose()
  contentChangeDisposable = null

  const model = await getOrCreateModel(path)
  editor.setModel(model)

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
    // Silent no-op when tearing down LSP state.
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

watch([editorFontSize, lineNumbersOption, wordWrapOption], () => {
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
  registeredLspLanguages.clear()

  for (const [path, model] of models.entries()) {
    clearLspMarkers(model)
    closeLspDocument(path).catch(() => {
      // Silent no-op during unmount.
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
