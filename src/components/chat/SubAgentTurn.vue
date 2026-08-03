<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BotIcon, CheckIcon, ChevronRightIcon, LoaderCircleIcon, SquareIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import type { SubagentTimelineItem } from '@/types/chat/chat-timeline-item'
import { HOME_CHAT_SLUG, isHomeChatSlug } from '@/constants/home-chat'
import chatRouteFor from '@/utils/chat-route-for'
import formatModelLabelFromRef from '@/utils/format-model-label-from-ref'

const props = defineProps<{
  subagent: SubagentTimelineItem
}>()

const emit = defineEmits<{
  stopSubagent: [subagentId: string]
}>()

const route = useRoute()
const router = useRouter()

const isRunning = computed(() => props.subagent.status === 'running')
const modelLabel = computed(() => formatModelLabelFromRef(props.subagent.model))
const label = computed(() => {
  const name = props.subagent.name.trim() || 'Sub-agent'
  const base = isRunning.value
    ? `Spawned sub-agent ${name}…`
    : `Spawned sub-agent ${name}`
  if (!modelLabel.value) {
    return base
  }
  return `${base} on ${modelLabel.value}`
})

const openSubagentChat = async (): Promise<void> => {
  const chatId = String(route.params.chatId ?? '')
  if (!chatId) {
    toast.error('Chat not found')
    return
  }
  const isStandalone =
    route.name === 'home-chat' ||
    route.name === 'home-chat-subagent' ||
    isHomeChatSlug(String(route.params.slug ?? ''))
  const projectSlug = isStandalone
    ? HOME_CHAT_SLUG
    : String(route.params.slug ?? '')
  try {
    await router.push(
      chatRouteFor(projectSlug, chatId, props.subagent.subagentId),
    )
  } catch (error) {
    toast.error('Failed to open sub-agent', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleStop = (): void => {
  emit('stopSubagent', props.subagent.subagentId)
}
</script>

<template>
  <div class="flex w-full max-w-full items-center gap-1">
    <button
      type="button"
      class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md py-0.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
      @click="openSubagentChat"
    >
      <LoaderCircleIcon
        v-if="isRunning"
        class="size-3.5 shrink-0 animate-spin"
      />
      <CheckIcon
        v-else
        class="size-3.5 shrink-0"
      />
      <BotIcon class="size-3.5 shrink-0" />
      <span class="min-w-0 flex-1 truncate">{{ label }}</span>
      <ChevronRightIcon class="size-3.5 shrink-0 opacity-60" />
    </button>
    <button
      v-if="isRunning"
      type="button"
      class="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
      title="Stop sub-agent"
      @click="handleStop"
    >
      <SquareIcon class="size-3.5" />
    </button>
  </div>
</template>
