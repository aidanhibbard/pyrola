<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import * as monaco from 'monaco-editor'
import { fsReadFile, fsWriteFile } from '@/services/pyrola/pyrola-tauri'
import useFleetRegistry from '@/composables/use-fleet-registry'

const props = defineProps<{
  projectId: string
  path: string | null
  openPaths?: string[]
}>()

const emit = defineEmits<{
  'dirty-change': [payload: { path: string; dirty: boolean }]
  saved: [payload: { path: string; content: string }]
}>()

const fleet = useFleetRegistry()
const containerRef = ref<HTMLDivElement | null>(null)
const saving = ref(false)

let editor: monaco.editor.IStandaloneCodeEditor | null = null
let resizeObserver: ResizeObserver | null = null
let contentChangeDisposable: monaco.IDisposable | null = null
const models = new Map<string, monaco.editor.ITextModel>()
const dirtyByPath = new Map<string, boolean>()

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
  return 'plaintext'
}

const layoutEditor = (): void => {
  editor?.layout()
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
  })

  emit('dirty-change', { path, dirty: isPathDirty(path) })
  layoutEditor()
}

const disposeModel = (path: string): void => {
  const model = models.get(path)
  if (!model) {
    return
  }
  if (editor?.getModel() === model) {
    editor.setModel(null)
  }
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

  editor = monaco.editor.create(containerRef.value, {
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    theme: 'vs-dark',
    wordWrap: 'on',
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

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
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

onBeforeUnmount(() => {
  contentChangeDisposable?.dispose()
  contentChangeDisposable = null
  for (const model of models.values()) {
    model.dispose()
  }
  models.clear()
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
