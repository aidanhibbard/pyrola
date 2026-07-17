<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import * as monaco from 'monaco-editor'
import { fsReadFile } from '@/services/pyrola/pyrola-tauri'
import useFleetRegistry from '@/composables/use-fleet-registry'

const props = defineProps<{
  projectId: string
  path: string | null
}>()

const fleet = useFleetRegistry()
const containerRef = ref<HTMLDivElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let resizeObserver: ResizeObserver | null = null

const formatLoadError = (error: unknown): string => {
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

const projectRoot = computed(
  () => fleet.projects.value.find((p) => p.id === props.projectId)?.rootPath ?? null,
)

const loadFile = async (path: string): Promise<void> => {
  const root = projectRoot.value
  if (!root || !editor) {
    return
  }
  const result = await fsReadFile({ projectRoot: root, path })
  const language = path.endsWith('.vue')
    ? 'html'
    : path.endsWith('.ts')
      ? 'typescript'
      : path.endsWith('.rs')
        ? 'rust'
        : 'plaintext'
  const model = monaco.editor.createModel(result.content, language)
  editor.setModel(model)
  layoutEditor()
}

onMounted(() => {
  if (!containerRef.value) {
    return
  }
  editor = monaco.editor.create(containerRef.value, {
    automaticLayout: true,
    minimap: { enabled: false },
    readOnly: true,
    scrollBeyondLastLine: false,
    theme: 'vs-dark',
    wordWrap: 'on',
  })
  if (props.path) {
    loadFile(props.path).catch((error) => {
      toast.error('Failed to load file', {
        description: formatLoadError(error),
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
  (path) => {
    if (path) {
      loadFile(path).catch((error) => {
        toast.error('Failed to load file', {
          description: formatLoadError(error),
        })
      })
    }
  },
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  editor?.dispose()
})
</script>

<template>
  <div
    ref="containerRef"
    class="h-full min-h-0 w-full overflow-hidden"
  />
</template>
