<script setup lang="ts">
import type { ChatStatus } from 'ai'
import type { ChatTimelineItem } from '@/types/chat/chat-timeline-item'
import type { PendingQuestionState } from '@/types/chat/pending-question'
import type { PendingMcpAuthView } from '@/types/chat/pending-mcp-auth'
import type { ApprovalResolution } from '@/services/harness/approval-gate'
import type { PendingApprovalView } from '@/services/harness/gate-tool-permission'
import ChatThreadContent from '@/components/chat/ChatThreadContent.vue'
import { MessageScrollerProvider } from '@/components/shadcn/ui/message-scroller'

defineProps<{
  timeline: ChatTimelineItem[]
  status?: ChatStatus
  pendingApprovals: PendingApprovalView[]
  pendingQuestion?: PendingQuestionState | null
  pendingMcpAuth?: PendingMcpAuthView[]
  readOnly?: boolean
}>()

defineEmits<{
  resolveApproval: [toolCallId: string, resolution: ApprovalResolution]
  submitAnswer: [toolCallId: string, answer: string]
  authenticateMcp: [toolCallId: string]
  skipMcpAuth: [toolCallId: string]
  openMcpSettings: [serverId: string]
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
      :pending-mcp-auth="pendingMcpAuth"
      :read-only="readOnly"
      @resolve-approval="(toolCallId, resolution) => $emit('resolveApproval', toolCallId, resolution)"
      @submit-answer="(toolCallId, answer) => $emit('submitAnswer', toolCallId, answer)"
      @authenticate-mcp="(toolCallId) => $emit('authenticateMcp', toolCallId)"
      @skip-mcp-auth="(toolCallId) => $emit('skipMcpAuth', toolCallId)"
      @open-mcp-settings="(serverId) => $emit('openMcpSettings', serverId)"
      @retry="$emit('retry')"
      @stop-subagent="$emit('stopSubagent', $event)"
    />
  </MessageScrollerProvider>
</template>
