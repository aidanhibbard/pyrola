<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { listen } from '@tauri-apps/api/event'
import { toast } from 'vue-sonner'
import * as monaco from 'monaco-editor'
import {
  fsReadFile,
  fsWriteFile,
  gitShowFile,
  isTauri,
  lspEnsureServer,
  lspRequest,
} from '@/services/pyrola/pyrola-tauri'
import useWorkbenchStore from '@/composables/use-workbench-store'
import useLspStatus from '@/composables/use-lsp-status'
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
  lineNumbers?: boolean
  wordWrap?: boolean
  diffView?: boolean
}>()

const emit = defineEmits<{
  'dirty-change': [payload: { path: string; dirty: boolean }]
  saved: [payload: { path: string; content: string }]
}>()

const workbench = useWorkbenchStore()
const lspStatus = useLspStatus()
const containerRef = ref<HTMLDivElement | null>(null)
const saving = ref(false)

let editor: monaco.editor.IStandaloneCodeEditor | null = null
let diffEditor: monaco.editor.IStandaloneDiffEditor | null = null
let editorInitializing = false
let resizeObserver: ResizeObserver | null = null
let contentChangeDisposable: monaco.IDisposable | null = null
let lspProviderDisposables: monaco.IDisposable[] = []
let unlistenDiagnostics: (() => void) | null = null
let stopThemeObserver: (() => void) | null = null
let lspProvidersRegistered = false
const models = new Map<string, monaco.editor.ITextModel>()
const originalModels = new Map<string, monaco.editor.ITextModel>()
const pathByModel = new Map<monaco.editor.ITextModel, string>()
const lspServerByPath = new Map<string, string>()
const dirtyByPath = new Map<string, boolean>()
const lastLspContentByPath = new Map<string, string>()

const lspActive = computed(() => isTauri())

const lineNumbersOption = computed((): 'on' | 'off' =>
  props.lineNumbers !== false ? 'on' : 'off',
)

const wordWrapOption = computed((): 'on' | 'off' =>
  props.wordWrap === true ? 'on' : 'off',
)

const projectRoot = computed(
  () => workbench.getProject(props.projectId)?.rootPath ?? null,
)

const hasActiveEditor = (): boolean => editor !== null || diffEditor !== null

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
  diffEditor?.layout()
}

const hasEditorDimensions = (element: HTMLElement): boolean =>
  element.clientWidth > 0 && element.clientHeight > 0

const ensureLanguageRegistered = (languageId: string): void => {
  if (
    languageId !== 'plaintext' &&
    !monaco.languages.getLanguages().some((language) => language.id === languageId)
  ) {
    monaco.languages.register({ id: languageId })
  }
}

const prepareMonacoEnvironment = (): void => {
  ensureMonacoBaseThemes(monaco)
  applyMonacoTheme(monaco)

  stopThemeObserver?.()
  stopThemeObserver = observeMonacoTheme(monaco, layoutEditor)

  // Silence Monaco's built-in TypeScript worker diagnostics. The bundled
  // tsserver worker does not understand Vue SFC or Vite CSS module imports,
  // so it produces false positives (e.g. "Cannot find module './App.vue'")
  // that Cursor/Volar do not show. Accurate diagnostics come from the
  // external LSP (Volar) when language servers are available.
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
}

const disposeCodeEditor = (): void => {
  contentChangeDisposable?.dispose()
  contentChangeDisposable = null
  editor?.dispose()
  editor = null
}

const disposeDiffEditorInstance = (): void => {
  diffEditor?.setModel(null)
  diffEditor?.dispose()
  diffEditor = null
}

const disposeOriginalModels = (): void => {
  for (const model of originalModels.values()) {
    model.dispose()
  }
  originalModels.clear()
}

const getOrCreateOriginalModel = async (
  path: string,
): Promise<monaco.editor.ITextModel> => {
  const root = projectRoot.value
  if (!root) {
    throw new Error('Project not found')
  }

  let content = ''
  try {
    const result = await gitShowFile({ projectRoot: root, path })
    content = result.content
  } catch (error) {
    toast.error('Failed to load HEAD version', {
      description: formatError(error),
    })
  }

  const existing = originalModels.get(path)
  if (existing) {
    if (existing.getValue() !== content) {
      existing.setValue(content)
    }
    return existing
  }

  const languageId = detectMonacoLanguage(path)
  ensureLanguageRegistered(languageId)
  const uri = monaco.Uri.parse(`pyrola-git-head://${encodeURIComponent(path)}`)
  const model = monaco.editor.createModel(content, languageId, uri)
  originalModels.set(path, model)
  ensureMonacoLanguage(monaco, languageId).catch(() => {
    // Highlighting is best-effort; the model already has content.
  })
  return model
}

const attachDiffModels = async (path: string): Promise<void> => {
  const activeDiff = diffEditor
  if (!activeDiff) {
    return
  }

  const [original, modified] = await Promise.all([
    getOrCreateOriginalModel(path),
    getOrCreateModel(path, { allowMissing: true }),
  ])

  if (diffEditor !== activeDiff) {
    return
  }

  activeDiff.setModel({ original, modified })
  layoutEditor()
}

const createCodeEditorInstance = async (): Promise<boolean> => {
  if (!containerRef.value || editor || diffEditor) {
    return editor !== null
  }

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

  return editor === created
}

const createDiffEditorInstance = async (): Promise<boolean> => {
  if (!containerRef.value || editor || diffEditor) {
    return diffEditor !== null
  }

  const created = monaco.editor.createDiffEditor(containerRef.value, {
    ...resolveMonacoEditorOptions(),
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    lineNumbers: lineNumbersOption.value,
    wordWrap: wordWrapOption.value,
    readOnly: true,
    originalEditable: false,
    renderSideBySide: true,
  })
  diffEditor = created

  if (props.path) {
    await attachDiffModels(props.path)
  }

  return diffEditor === created
}

const switchToDiffView = async (): Promise<void> => {
  if (diffEditor) {
    if (props.path) {
      await attachDiffModels(props.path)
    }
    return
  }

  disposeCodeEditor()
  prepareMonacoEnvironment()
  const created = await createDiffEditorInstance()
  if (!created) {
    return
  }

  try {
    await ensureMonacoShiki(monaco)
    if (diffEditor) {
      applyMonacoTheme(monaco)
    }
  } catch (error) {
    toast.error('Syntax highlighting unavailable', {
      description: formatError(error),
    })
  }
}

const switchToCodeView = async (): Promise<void> => {
  if (editor) {
    if (props.path) {
      await attachModel(props.path)
    }
    return
  }

  disposeDiffEditorInstance()
  disposeOriginalModels()
  prepareMonacoEnvironment()
  const created = await createCodeEditorInstance()
  if (!created) {
    return
  }

  try {
    await ensureMonacoShiki(monaco)
    if (editor) {
      applyMonacoTheme(monaco)
    }
  } catch (error) {
    toast.error('Syntax highlighting unavailable', {
      description: formatError(error),
    })
  }
}

const initializeEditor = async (): Promise<boolean> => {
  if (!containerRef.value || hasActiveEditor() || editorInitializing) {
    return hasActiveEditor()
  }

  if (!hasEditorDimensions(containerRef.value)) {
    return false
  }

  editorInitializing = true
  try {
    prepareMonacoEnvironment()

    // Create the editor synchronously first so opening a file never waits on
    // Shiki and cannot race setModel against a null editor.
    const created = props.diffView
      ? await createDiffEditorInstance()
      : await createCodeEditorInstance()

    if (!created) {
      return false
    }

    try {
      await ensureMonacoShiki(monaco)
      if (hasActiveEditor()) {
        applyMonacoTheme(monaco)
      }
    } catch (error) {
      toast.error('Syntax highlighting unavailable', {
        description: formatError(error),
      })
    }

    return hasActiveEditor()
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
  const options = {
    lineNumbers: lineNumbersOption.value,
    wordWrap: wordWrapOption.value,
  }
  editor?.updateOptions(options)
  diffEditor?.updateOptions(options)
}

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

/** Vue LS 3 hybrid mode: script hover/defs/completion come from TypeScript + plugin. */
const serversForLspFeature = (path: string, primaryId: string): string[] => {
  if (primaryId === 'vue' || fileExtension(path) === 'vue') {
    return primaryId === 'vue' ? ['typescript', 'vue'] : ['typescript', primaryId]
  }
  return [primaryId]
}

const withLspTimeout = async <T>(
  work: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      work,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer !== null) {
      clearTimeout(timer)
    }
  }
}

const syncDocumentToLsp = async (path: string, content: string): Promise<void> => {
  const serverId = getLspServerId(path)
  if (!lspActive.value || !serverId) {
    return
  }

  if (lastLspContentByPath.get(path) === content) {
    return
  }

  await lspRequest(serverId, 'textDocument/didChange', { path, content })
  lastLspContentByPath.set(path, content)
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
    lastLspContentByPath.delete(path)
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
    if (server.id === 'vue' || server.id === 'typescript') {
      lspStatus.markAwaitingProjectLoad(server.id)
    }
    // Vue LS 3 hybrid: script features need TypeScript + @vue/typescript-plugin.
    if (server.id === 'vue') {
      try {
        await lspEnsureServer('ts', root)
      } catch (error) {
        toast.error('TypeScript language server unavailable', {
          description:
            formatError(error) +
            '. Vue script hover and completions need TypeScript with the Vue plugin.',
        })
      }
    }
    await lspRequest(server.id, 'textDocument/didOpen', {
      path,
      content: model.getValue(),
    })
    lastLspContentByPath.set(path, model.getValue())
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
        if (!path) {
          return null
        }

        let primaryId = getLspServerId(path)
        if (!primaryId) {
          try {
            await setupLspForPath(path, model)
          } catch {
            return null
          }
          primaryId = getLspServerId(path)
        }
        if (!primaryId) {
          return null
        }

        try {
          const result = await withLspTimeout(
            (async () => {
              await syncDocumentToLsp(path, model.getValue())
              const positionPayload = {
                line: position.lineNumber - 1,
                character: position.column - 1,
              }
              for (const serverId of serversForLspFeature(path, primaryId)) {
                try {
                  const candidate = await lspRequest(serverId, 'hover', {
                    path,
                    position: positionPayload,
                  })
                  if (parseLspHoverContents(candidate).length > 0) {
                    return candidate
                  }
                } catch {
                  // Try the next capable server (Vue hybrid: TS then Vue).
                }
              }
              return null
            })(),
            10_000,
            'Hover',
          )

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
        const primaryId = path ? getLspServerId(path) : null
        if (!path || !primaryId) {
          return null
        }

        try {
          await syncDocumentToLsp(path, model.getValue())
          const positionPayload = {
            line: position.lineNumber - 1,
            character: position.column - 1,
          }
          let locations: ReturnType<typeof parseLspLocations> = []
          for (const serverId of serversForLspFeature(path, primaryId)) {
            try {
              const result = await lspRequest(serverId, 'goToDefinition', {
                path,
                position: positionPayload,
              })
              locations = parseLspLocations(result)
              if (locations.length > 0) {
                break
              }
            } catch {
              // Try the next capable server.
            }
          }
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
        const primaryId = path ? getLspServerId(path) : null
        if (!path || !primaryId) {
          return { suggestions: [] }
        }

        try {
          await syncDocumentToLsp(path, model.getValue())
          const positionPayload = {
            line: position.lineNumber - 1,
            character: position.column - 1,
          }
          for (const serverId of serversForLspFeature(path, primaryId)) {
            try {
              const result = await lspRequest(serverId, 'textDocument/completion', {
                path,
                position: positionPayload,
              })
              const suggestions = parseLspCompletionItems(result, monaco)
              if (suggestions.length > 0) {
                return { suggestions }
              }
            } catch {
              // Try the next capable server.
            }
          }
          return { suggestions: [] }
        } catch {
          return { suggestions: [] }
        }
      },
    }),
  )
}

const getOrCreateModel = async (
  path: string,
  options?: { allowMissing?: boolean },
): Promise<monaco.editor.ITextModel> => {
  const existing = models.get(path)
  const root = projectRoot.value
  if (!root) {
    throw new Error('Project not found')
  }

  if (existing) {
    if (options?.allowMissing && !isPathDirty(path)) {
      try {
        const result = await fsReadFile({ projectRoot: root, path })
        if (existing.getValue() !== result.content) {
          existing.setValue(result.content)
        }
      } catch {
        if (existing.getValue() !== '') {
          existing.setValue('')
        }
      }
    }
    return existing
  }

  let content = ''
  try {
    const result = await fsReadFile({ projectRoot: root, path })
    content = result.content
  } catch (error) {
    if (!options?.allowMissing) {
      throw error
    }
  }

  const languageId = detectMonacoLanguage(path)
  ensureLanguageRegistered(languageId)
  const model = monaco.editor.createModel(content, languageId)
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

  const diffModel = diffEditor?.getModel()
  if (diffModel?.modified === model) {
    diffEditor?.setModel(null)
  }

  const original = originalModels.get(path)
  if (original) {
    original.dispose()
    originalModels.delete(path)
  }

  pathByModel.delete(model)
  model.dispose()
  models.delete(path)
  dirtyByPath.delete(path)
  lastLspContentByPath.delete(path)
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
  if (!root || !path || !editor || props.diffView || saving.value) {
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
      if (!hasActiveEditor()) {
        tryInitializeEditor()
        return
      }
      layoutEditor()
    })
    resizeObserver.observe(containerRef.value)
  }
})

watch(
  () => props.diffView === true,
  (enabled) => {
    const switchView = enabled ? switchToDiffView : switchToCodeView
    switchView().catch((error) => {
      toast.error(enabled ? 'Failed to open diff view' : 'Failed to open editor', {
        description: formatError(error),
      })
    })
  },
)

watch(
  () => props.path,
  (path, previousPath) => {
    if (!path || path === previousPath) {
      return
    }
    if (props.diffView) {
      attachDiffModels(path).catch((error) => {
        toast.error('Failed to load diff', {
          description: formatError(error),
        })
      })
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
  () => workbench.workspaceFileReloadNonce.value,
  async () => {
    const path = props.path
    if (!path) {
      return
    }
    const paths = workbench.workspaceFileReloadPaths.value
    if (!paths.includes(path)) {
      return
    }
    const root = projectRoot.value
    if (!root) {
      return
    }
    try {
      const model = models.get(path)
      if (!model) {
        return
      }
      const result = await fsReadFile({ projectRoot: root, path })
      if (model.getValue() !== result.content) {
        model.setValue(result.content)
      }
      dirtyByPath.set(path, false)
      emit('dirty-change', { path, dirty: false })
    } catch {
      const model = models.get(path)
      if (model && model.getValue() !== '') {
        model.setValue('')
      }
      dirtyByPath.set(path, false)
      emit('dirty-change', { path, dirty: false })
    }
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
  lastLspContentByPath.clear()
  resizeObserver?.disconnect()
  resizeObserver = null
  disposeDiffEditorInstance()
  disposeOriginalModels()
  disposeCodeEditor()
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
