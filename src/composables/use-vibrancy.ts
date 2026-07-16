import { useColorMode, useStorage } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { onMounted, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const isLinux = (): boolean => navigator.userAgent.toLowerCase().includes('linux')

const applyLinuxFallback = (isDark: boolean): void => {
  document.documentElement.classList.toggle('linux-vibrancy', true)
  document.documentElement.classList.toggle('dark-vibrancy', isDark)
  document.documentElement.classList.remove('vibrancy-off')
}

const clearLinuxFallback = (): void => {
  document.documentElement.classList.remove('linux-vibrancy', 'dark-vibrancy')
  document.documentElement.classList.add('vibrancy-off')
}

const applyNativeVibrancy = async (isDark: boolean): Promise<void> => {
  await invoke(isDark ? 'set_vibrancy_dark' : 'set_vibrancy_light')
}

const clearNativeVibrancy = async (): Promise<void> => {
  await invoke('clear_vibrancy')
}

// Shared across every call to `useVibrancy` so the titlebar toggle and any
// other consumer stay in sync and the preference persists across launches.
export const vibrancyEnabled = useStorage('pyrola-vibrancy-enabled', true)

export default () => {
  const mode = useColorMode()

  const syncVibrancy = async (): Promise<void> => {
    const isDark = mode.value === 'dark'

    if (!vibrancyEnabled.value) {
      clearLinuxFallback()
      try {
        await clearNativeVibrancy()
      } catch (error) {
        toast.error('Failed to disable glass effect', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
      return
    }

    document.documentElement.classList.remove('vibrancy-off')

    if (isLinux()) {
      applyLinuxFallback(isDark)
      return
    }

    try {
      await applyNativeVibrancy(isDark)
    } catch (error) {
      toast.error('Failed to apply glass effect', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  watch([() => mode.value, () => vibrancyEnabled.value], syncVibrancy)

  onMounted(syncVibrancy)

  return { vibrancyEnabled }
}
