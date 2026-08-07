<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CheckIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  SquareIcon,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import NavigationAsideLeftChatRunningDots from '@/components/navigation/aside/left/ChatRunningDots.vue'
import { Button } from '@/components/shadcn/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
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
const displayName = computed(() => {
  const name = props.subagent.name.trim() || 'Sub-agent'
  return isRunning.value ? `${name}…` : name
})

const statusIcon = computed(() => {
  if (props.subagent.status === 'stopped') {
    return SquareIcon
  }
  if (props.subagent.status === 'error') {
    return CircleAlertIcon
  }
  return CheckIcon
})

const statusIconClass = computed(() => {
  if (props.subagent.status === 'error') {
    return 'size-3.5 shrink-0 text-destructive'
  }
  if (props.subagent.status === 'stopped') {
    return 'size-3 shrink-0'
  }
  return 'size-3.5 shrink-0'
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
      <NavigationAsideLeftChatRunningDots
        v-if="isRunning"
      />
      <component
        :is="statusIcon"
        v-else
        :class="statusIconClass"
      />
      <span class="min-w-0 flex-1">
        <span class="block truncate">{{ displayName }}</span>
        <span
          v-if="modelLabel"
          class="block truncate text-[10px] leading-tight text-muted-foreground/80"
        >{{ modelLabel }}</span>
      </span>
      <ChevronRightIcon class="size-3.5 shrink-0 opacity-60" />
    </button>
    <Tooltip v-if="isRunning">
      <TooltipTrigger as-child>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-6 shrink-0 text-muted-foreground"
          aria-label="Stop sub-agent"
          @click="handleStop"
        >
          <SquareIcon class="size-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Stop sub-agent</TooltipContent>
    </Tooltip>
  </div>
</template>
