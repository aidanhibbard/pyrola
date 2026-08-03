<script setup lang="ts">
import type { ChatStatus } from 'ai'
import type { ChatTimelineItem } from '@/types/chat/chat-timeline-item'
import type { PendingQuestionState } from '@/types/chat/pending-question'
import type { ApprovalResolution } from '@/services/harness/approval-gate'
import type { PendingApprovalView } from '@/services/harness/gate-tool-permission'
import ChatThreadContent from '@/components/chat/ChatThreadContent.vue'
import { MessageScrollerProvider } from '@/components/shadcn/ui/message-scroller'

defineProps<{
  timeline: ChatTimelineItem[]
  status?: ChatStatus
  pendingApprovals: PendingApprovalView[]
  pendingQuestion?: PendingQuestionState | null
  readOnly?: boolean
}>()

defineEmits<{
  resolveApproval: [toolCallId: string, resolution: ApprovalResolution]
  submitAnswer: [toolCallId: string, answer: string]
  retry: []
  stopSubagent: [subagentId: string]
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
      :read-only="readOnly"
      @resolve-approval="(toolCallId, resolution) => $emit('resolveApproval', toolCallId, resolution)"
      @submit-answer="(toolCallId, answer) => $emit('submitAnswer', toolCallId, answer)"
      @retry="$emit('retry')"
      @stop-subagent="$emit('stopSubagent', $event)"
    />
  </MessageScrollerProvider>
</template>
