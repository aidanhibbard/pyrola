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
import ChatTodoTimeline from '@/components/chat/ChatTodoTimeline.vue'
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
  if (last?.type === 'todo') {
    return [
      props.timeline.length,
      last.todos.map((todo) => `${todo.id}:${todo.status}`).join('|'),
    ].join(':')
  }
  if (last?.type === 'subagent') {
    return [
      props.timeline.length,
      last.subagentId,
      last.status,
      last.summary?.length ?? 0,
    ].join(':')
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

const timelineItemId = (item: ChatTimelineItem, index: number): string => {
  if (item.type === 'user') {
    return item.message.id
  }
  if (item.type === 'todo') {
    return `todo-${index}`
  }
  if (item.type === 'subagent') {
    return `subagent-${item.subagentId}`
  }
  return item.turn.id || `turn-${index}`
}

const isLastItem = (index: number): boolean => index === props.timeline.length - 1

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
          v-for="(item, index) in timeline"
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
          <ChatTodoTimeline v-else-if="item.type === 'todo'" :todos="item.todos" />
          <ChatSubAgentTurn
            v-else-if="item.type === 'subagent'"
            :subagent="item"
          />
          <ChatAgentTurn v-else :turn="item.turn" :status="isLastItem(index) ? status : 'ready'" />
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
