<script setup lang="ts">
import { MessageSquare, Unlock } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

defineProps<{
  ownerTitle: string
  waiterCount: number
}>()

const emit = defineEmits<{
  'open-chat': []
  'take-control': []
}>()
</script>

<template>
  <div
    class="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center"
    role="dialog"
    aria-label="Browser locked by agent"
  >
    <div
      class="flex max-w-[min(20rem,calc(100%-2rem))] items-center gap-1 rounded-full border border-border/50 bg-white/85 px-2 py-1 shadow-sm backdrop-blur-xl dark:bg-black/85"
    >
      <p class="min-w-0 truncate px-1 text-xs font-medium">
        {{ ownerTitle }}
      </p>
      <p
        v-if="waiterCount > 0"
        class="shrink-0 pr-1 text-xs text-muted-foreground"
      >
        {{ waiterCount }} waiting
      </p>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7 shrink-0"
            type="button"
            aria-label="Open chat"
            @click="emit('open-chat')"
          >
            <MessageSquare class="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent class="z-60">Open chat</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7 shrink-0"
            type="button"
            aria-label="Take Control"
            @click="emit('take-control')"
          >
            <Unlock class="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent class="z-60">Take Control</TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>
