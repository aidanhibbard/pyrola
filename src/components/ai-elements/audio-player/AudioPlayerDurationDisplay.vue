<script setup lang="ts">
import type { MediaDurationDisplay } from 'media-chrome'
import type { HTMLAttributes } from 'vue'
import { ButtonGroupText } from '@/components/ui/button-group'
import { cn } from '@/lib/utils'

interface Props extends /* @vue-ignore */ Partial<MediaDurationDisplay> {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <ButtonGroupText
    as-child
    class="bg-transparent"
  >
    <media-duration-display
      :class="cn('tabular-nums', props.class)"
      data-slot="audio-player-duration-display"
    />
  </ButtonGroupText>
</template>
