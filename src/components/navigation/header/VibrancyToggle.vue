<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { GlassWater } from '@lucide/vue'
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/shadcn/ui/button'
import usePyrolaConfig from '@/composables/use-pyrola-config'

defineProps<{
  class?: HTMLAttributes['class']
}>()

const config = usePyrolaConfig()

const vibrancyEnabled = computed(
  () => config.effectiveSettings.value['appearance.glass'] ?? true,
)

const toggleVibrancy = async (): Promise<void> => {
  try {
    await config.setGlass('personal', !vibrancyEnabled.value)
  } catch (error) {
    toast.error('Failed to save window glass setting', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
</script>

<template>
  <Button
    data-slot="vibrancy-toggle"
    variant="ghost"
    size="icon"
    :aria-pressed="vibrancyEnabled"
    :class="cn('h-7 w-7', $props.class)"
    @click="toggleVibrancy"
  >
    <GlassWater
      class="h-[1.2rem] w-[1.2rem] transition-opacity"
      :class="vibrancyEnabled ? 'opacity-100' : 'opacity-40'"
    />
    <span class="sr-only">Toggle window glass effect</span>
  </Button>
</template>
