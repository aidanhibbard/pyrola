<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Moon, Sun } from '@lucide/vue'
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/shadcn/ui/button'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import type { PyrolaTheme } from '@/types/pyrola/pyrola-settings'

defineProps<{
  class?: HTMLAttributes['class']
}>()

const config = usePyrolaConfig()

const currentTheme = computed(
  () => config.effectiveSettings.value['appearance.theme'] ?? 'system',
)

const nextTheme = (): PyrolaTheme => {
  if (currentTheme.value === 'light') {
    return 'dark'
  }
  if (currentTheme.value === 'dark') {
    return 'system'
  }
  return 'light'
}

const toggleMode = async (): Promise<void> => {
  try {
    const theme = nextTheme()
    await config.setTheme('personal', theme)
  } catch (error) {
    toast.error('Failed to save theme', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
</script>

<template>
  <Button
    data-slot="mode-toggle"
    variant="ghost"
    size="icon"
    :class="cn('h-7 w-7', $props.class)"
    @click="toggleMode"
  >
    <Moon
      class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
    />
    <Sun
      class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
    />
    <span class="sr-only">Toggle theme</span>
  </Button>
</template>
