import { useColorMode } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { onMounted, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import usePyrolaConfig from '@/composables/use-pyrola-config'

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

export default () => {
  const mode = useColorMode()
  const config = usePyrolaConfig()

  const syncTheme = (): void => {
    const theme = config.effectiveSettings.value['appearance.theme'] ?? 'system'
    if (theme === 'system') {
      mode.value = 'auto'
      return
    }
    mode.value = theme
  }

  const syncVibrancy = async (): Promise<void> => {
    syncTheme()

    const glassEnabled = config.effectiveSettings.value['appearance.glass'] ?? true
    const glassVariant = config.effectiveSettings.value['appearance.glassVariant'] ?? 'dark'
    const isDark = glassVariant === 'dark' || mode.value === 'dark'

    if (!glassEnabled) {
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

  watch(
    () => [
      config.effectiveSettings.value['appearance.glass'],
      config.effectiveSettings.value['appearance.glassVariant'],
      config.effectiveSettings.value['appearance.theme'],
      config.hydrated.value,
    ],
    async () => {
      if (config.hydrated.value) {
        try {
          await syncVibrancy()
        } catch (error) {
          toast.error('Failed to sync appearance', {
            description: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    },
    { deep: true },
  )

  onMounted(async () => {
    if (config.hydrated.value) {
      try {
        await syncVibrancy()
      } catch (error) {
        toast.error('Failed to sync appearance', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  })

  return { syncVibrancy }
}
