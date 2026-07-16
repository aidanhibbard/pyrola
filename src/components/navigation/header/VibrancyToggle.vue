<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { GlassWater } from '@lucide/vue'
import { cn } from '@/lib/utils'
import { Button } from '@/components/shadcn/ui/button'
import useVibrancy from '@/composables/use-vibrancy'

defineProps<{
  class?: HTMLAttributes['class']
}>()

const { vibrancyEnabled } = useVibrancy()

const toggleVibrancy = () => {
  vibrancyEnabled.value = !vibrancyEnabled.value
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
