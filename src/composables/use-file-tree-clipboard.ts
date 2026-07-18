import { computed, ref } from 'vue'

type ClipboardMode = 'cut' | 'copy'

type ClipboardState = {
  path: string
  mode: ClipboardMode
} | null

const clipboard = ref<ClipboardState>(null)

export default () => {
  const setCut = (path: string): void => {
    clipboard.value = { path, mode: 'cut' }
  }

  const setCopy = (path: string): void => {
    clipboard.value = { path, mode: 'copy' }
  }

  const clear = (): void => {
    clipboard.value = null
  }

  const hasClipboard = computed(() => clipboard.value !== null)

  const clipboardPath = computed(() => clipboard.value?.path ?? null)

  const mode = computed(() => clipboard.value?.mode ?? null)

  return {
    setCut,
    setCopy,
    clear,
    hasClipboard,
    clipboardPath,
    mode,
  }
}
