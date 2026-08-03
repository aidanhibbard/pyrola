<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { ChatStatus } from 'ai'
import type { FileDiff } from '@/types/harness/file-diff'
import type { ChatTimelineItem } from '@/types/chat/chat-timeline-item'
import type { PendingQuestionState } from '@/types/chat/pending-question'
import ChatAgentTurn from '@/components/chat/ChatAgentTurn.vue'
import ChatMessageTurn from '@/components/chat/ChatMessageTurn.vue'
import ChatQuestionCard from '@/components/chat/ChatQuestionCard.vue'
import ChatToolCard from '@/components/chat/ChatToolCard.vue'
import ChatSubAgentTurn from '@/components/chat/SubAgentTurn.vue'
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
  useMessageScroller,
} from '@/components/shadcn/ui/message-scroller'
import { useMessageScrollerContext } from '@/components/shadcn/ui/message-scroller/useMessageScroller'

const props = defineProps<{
  timeline: ChatTimelineItem[]
  status?: ChatStatus
  pendingApprovals: Array<{ toolCallId: string; name: string; diff: FileDiff[] }>
  pendingQuestion?: PendingQuestionState | null
}>()

const emit = defineEmits<{
  approve: [toolCallId: string]
  reject: [toolCallId: string]
  submitAnswer: [toolCallId: string, answer: string]
  retry: []
}>()

const { scrollToEnd } = useMessageScroller()
const { handleContentChange } = useMessageScrollerContext()

const approvalMap = computed(() => {
  const map = new Map<string, { name: string; diff: FileDiff[] }>()
  for (const item of props.pendingApprovals) {
    map.set(item.toolCallId, { name: item.name, diff: item.diff })
  }
  return map
})

const isLive = computed(() => props.status === 'streaming' || props.status === 'submitted')

const streamRevision = computed(() => {
  const last = props.timeline.at(-1)
  if (last?.type === 'subagent') {
    return [
      props.timeline.length,
      last.subagentId,
      last.status,
      last.summary?.length ?? 0,
    ].join(':')
  }
  if (last?.type === 'todo') {
    // Todos render beside the prompt, not in the scroll thread.
    const prior = props.timeline.at(-2)
    if (prior?.type === 'agent-turn') {
      return [
        props.timeline.length,
        prior.turn.text.length,
        prior.turn.steps
          .map(
            (step) =>
              `${step.text.length}:${step.reasoning.length}:${step.tools.length}`,
          )
          .join(';'),
      ].join(':')
    }
    return props.timeline.length
  }
  if (last?.type !== 'agent-turn') {
    return props.timeline.length
  }
  const turn = last.turn
  return [
    props.timeline.length,
    turn.text.length,
    turn.steps
      .map(
        (step) =>
          `${step.text.length}:${step.reasoning.length}:${step.tools.length}:${step.tools
            .map((tool) => `${tool.toolCallId}:${tool.status}`)
            .join('|')}`,
      )
      .join(';'),
  ].join(':')
})

const visibleTimeline = computed(() =>
  props.timeline.filter((item) => item.type !== 'todo'),
)

const timelineItemId = (item: ChatTimelineItem, index: number): string => {
  if (item.type === 'user') {
    return item.message.id
  }
  if (item.type === 'subagent') {
    return `subagent-${item.subagentId}`
  }
  if (item.type === 'agent-turn') {
    return item.turn.id || `turn-${index}`
  }
  return `item-${index}`
}

const isLastItem = (index: number): boolean => index === visibleTimeline.value.length - 1

const followLiveOutput = async (): Promise<void> => {
  if (!isLive.value) {
    return
  }
  try {
    await nextTick()
    handleContentChange()
    scrollToEnd({ behavior: 'auto' })
  } catch (error) {
    toast.error('Failed to update chat scroll', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

watch(streamRevision, () => {
  followLiveOutput()
})

watch(
  () => props.status,
  (status) => {
    if (status === 'streaming' || status === 'submitted') {
      followLiveOutput()
    }
  },
)
</script>

<template>
  <MessageScroller class="h-full min-h-0 min-w-0 overflow-hidden">
    <MessageScrollerViewport class="scroll-fade-b overflow-x-hidden">
      <MessageScrollerContent
        class="mx-auto w-full min-w-0 max-w-3xl gap-6 overflow-x-hidden p-4 pb-2"
      >
        <MessageScrollerItem
          v-for="(item, index) in visibleTimeline"
          :key="timelineItemId(item, index)"
          :message-id="timelineItemId(item, index)"
          :scroll-anchor="isLastItem(index)"
          class="min-w-0 max-w-full"
        >
          <ChatMessageTurn
            v-if="item.type === 'user'"
            :message="item.message"
            :editable="!isLive"
          />
          <ChatSubAgentTurn
            v-else-if="item.type === 'subagent'"
            :subagent="item"
          />
          <ChatAgentTurn
            v-else-if="item.type === 'agent-turn'"
            :turn="item.turn"
            :status="isLastItem(index) ? status : 'ready'"
            @retry="emit('retry')"
          />
        </MessageScrollerItem>
        <ChatQuestionCard
          v-if="pendingQuestion"
          :question="pendingQuestion"
          @submit="(toolCallId, answer) => emit('submitAnswer', toolCallId, answer)"
        />
        <ChatToolCard
          v-for="[toolCallId, approval] in approvalMap"
          :key="toolCallId"
          :tool-call-id="toolCallId"
          :name="approval.name"
          :diffs="approval.diff"
          @approve="emit('approve', toolCallId)"
          @reject="emit('reject', toolCallId)"
        />
      </MessageScrollerContent>
    </MessageScrollerViewport>
  </MessageScroller>
</template>
