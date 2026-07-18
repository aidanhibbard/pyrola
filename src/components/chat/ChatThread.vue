<script setup lang="ts">
import type { ChatStatus } from 'ai'
import type { FileDiff } from '@/types/harness/file-diff'
import type { ChatTimelineItem } from '@/types/chat/chat-timeline-item'
import type { PendingQuestionState } from '@/types/chat/pending-question'
import ChatThreadContent from '@/components/chat/ChatThreadContent.vue'
import { MessageScrollerProvider } from '@/components/shadcn/ui/message-scroller'

defineProps<{
  timeline: ChatTimelineItem[]
  status?: ChatStatus
  pendingApprovals: Array<{ toolCallId: string; name: string; diff: FileDiff[] }>
  pendingQuestion?: PendingQuestionState | null
}>()

defineEmits<{
  approve: [toolCallId: string]
  reject: [toolCallId: string]
  submitAnswer: [toolCallId: string, answer: string]
}>()
</script>

<template>
  <MessageScrollerProvider
    :auto-scroll="true"
    default-scroll-position="end"
  >
    <ChatThreadContent
      :timeline="timeline"
      :status="status"
      :pending-approvals="pendingApprovals"
      :pending-question="pendingQuestion"
      @approve="$emit('approve', $event)"
      @reject="$emit('reject', $event)"
      @submit-answer="(toolCallId, answer) => $emit('submitAnswer', toolCallId, answer)"
    />
  </MessageScrollerProvider>
</template>
