<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as monaco from 'monaco-editor'
import {
  applyMonacoTheme,
  MONACO_EDITOR_OPTIONS,
  observeMonacoTheme,
} from '@/utils/monaco-theme'

const props = withDefaults(
  defineProps<{
    modelValue: string
    readOnly?: boolean
  }>(),
  {
    readOnly: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let resizeObserver: ResizeObserver | null = null
let contentDisposable: monaco.IDisposable | null = null
let isApplyingExternalValue = false
let stopThemeObserver: (() => void) | null = null

const layoutEditor = (): void => {
  editor?.layout()
}

const setEditorValue = (value: string): void => {
  if (!editor) {
    return
  }
  const model = editor.getModel()
  if (!model || model.getValue() === value) {
    return
  }
  isApplyingExternalValue = true
  editor.setValue(value)
  isApplyingExternalValue = false
}

onMounted(() => {
  if (!containerRef.value) {
    return
  }

  applyMonacoTheme(monaco)
  stopThemeObserver = observeMonacoTheme(monaco)

  editor = monaco.editor.create(containerRef.value, {
    ...MONACO_EDITOR_OPTIONS,
    automaticLayout: true,
    language: 'markdown',
    minimap: { enabled: false },
    readOnly: props.readOnly,
    scrollBeyondLastLine: false,
    wordWrap: 'on',
  })

  setEditorValue(props.modelValue)

  contentDisposable = editor.onDidChangeModelContent(() => {
    if (isApplyingExternalValue || !editor) {
      return
    }
    emit('update:modelValue', editor.getValue())
  })

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      layoutEditor()
    })
    resizeObserver.observe(containerRef.value)
  }
})

watch(
  () => props.modelValue,
  (value) => {
    setEditorValue(value)
  },
)

watch(
  () => props.readOnly,
  (readOnly) => {
    editor?.updateOptions({ readOnly })
  },
)

onBeforeUnmount(() => {
  stopThemeObserver?.()
  stopThemeObserver = null
  contentDisposable?.dispose()
  contentDisposable = null
  resizeObserver?.disconnect()
  resizeObserver = null
  editor?.dispose()
  editor = null
})
</script>

<template>
  <div
    ref="containerRef"
    class="h-full min-h-0 w-full overflow-hidden"
  />
</template>
