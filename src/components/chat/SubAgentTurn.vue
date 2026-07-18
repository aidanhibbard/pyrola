<script setup lang="ts">
import { computed, ref } from 'vue'
import { BotIcon, CheckIcon, ChevronRightIcon, LoaderCircleIcon } from '@lucide/vue'
import type { SubagentTimelineItem } from '@/types/chat/chat-timeline-item'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/ui/collapsible'

const props = defineProps<{
  subagent: SubagentTimelineItem
}>()

const open = ref(false)

const isRunning = computed(() => props.subagent.status === 'running')
const summary = computed(() => props.subagent.summary?.trim() ?? '')
const collapsedSummary = computed(() => {
  if (!summary.value) {
    return isRunning.value ? 'Running…' : 'Completed'
  }
  const singleLine = summary.value.replace(/\s+/g, ' ')
  return singleLine.length > 120 ? `${singleLine.slice(0, 117)}…` : singleLine
})
</script>

<template>
  <Collapsible
    v-model:open="open"
    class="w-full min-w-0 max-w-full rounded-lg border border-border/60 bg-muted/20"
  >
    <CollapsibleTrigger
      class="flex w-full max-w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/30"
    >
      <LoaderCircleIcon
        v-if="isRunning"
        class="size-3.5 shrink-0 animate-spin text-muted-foreground"
      />
      <CheckIcon
        v-else
        class="size-3.5 shrink-0 text-muted-foreground"
      />
      <ChevronRightIcon
        class="size-3.5 shrink-0 text-muted-foreground transition-transform"
        :class="open ? 'rotate-90' : ''"
      />
      <BotIcon class="size-3.5 shrink-0 text-muted-foreground" />
      <span class="min-w-0 truncate text-muted-foreground">
        <span class="text-foreground/70">Main agent</span>
        <span class="px-1">→</span>
        <span class="text-foreground">Sub-agent: {{ subagent.name }}</span>
      </span>
      <span
        v-if="!open"
        class="min-w-0 flex-1 truncate text-xs text-muted-foreground"
      >
        {{ collapsedSummary }}
      </span>
    </CollapsibleTrigger>
    <CollapsibleContent class="border-t border-border/60 px-3 py-2">
      <p
        v-if="isRunning && !summary"
        class="text-xs text-muted-foreground"
      >
        Running…
      </p>
      <pre
        v-else-if="summary"
        class="max-h-64 overflow-auto whitespace-pre-wrap wrap-break-word text-xs text-foreground/90"
      >{{ summary }}</pre>
    </CollapsibleContent>
  </Collapsible>
</template>
