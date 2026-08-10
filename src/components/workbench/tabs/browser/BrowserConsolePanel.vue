<script setup lang="ts">
import { Trash2 } from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
import type { BrowserConsoleLine } from '@/composables/use-browser-console'

defineProps<{
  lines: BrowserConsoleLine[]
}>()

const emit = defineEmits<{
  clear: []
}>()
</script>

<template>
  <div class="flex h-40 shrink-0 flex-col border-t border-border/50 bg-muted/20">
    <div class="flex items-center justify-between border-b border-border/40 px-2 py-1">
      <span class="text-xs font-medium text-muted-foreground">
        Console
      </span>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-6 w-6"
            type="button"
            aria-label="Clear console"
            :disabled="lines.length === 0"
            @click="emit('clear')"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Clear console</TooltipContent>
      </Tooltip>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto px-2 py-1 font-mono text-[11px] leading-relaxed">
      <div
        v-if="lines.length === 0"
        class="text-muted-foreground"
      >
        Console capture is available for agent-driven browsing
      </div>
      <div
        v-for="(line, index) in lines"
        :key="`${line.timestamp}-${index}`"
        class="whitespace-pre-wrap break-all text-foreground/90"
      >
        <span class="text-muted-foreground">{{ line.timestamp }}</span>
        <span class="mx-1 uppercase text-muted-foreground">{{ line.level }}</span>
        <span>{{ line.text }}</span>
      </div>
    </div>
  </div>
</template>
