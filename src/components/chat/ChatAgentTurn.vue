<script setup lang="ts">
import { computed } from 'vue'
import type { ChatStatus } from 'ai'
import type { AgentStep } from '@/types/chat/agent-step'
import type { AgentTurn } from '@/types/chat/agent-turn'
import AiElementsMessageMessageResponse from '@/components/ai-elements/message/MessageResponse.vue'
import AiElementsReasoningReasoning from '@/components/ai-elements/reasoning/Reasoning.vue'
import AiElementsReasoningReasoningContent from '@/components/ai-elements/reasoning/ReasoningContent.vue'
import AiElementsReasoningReasoningTrigger from '@/components/ai-elements/reasoning/ReasoningTrigger.vue'
import ChatToolRun from '@/components/chat/ChatToolRun.vue'

const props = defineProps<{
  turn: AgentTurn
  status?: ChatStatus
}>()

const isStreaming = computed(
  () => props.status === 'streaming' || props.status === 'submitted',
)

const isTextStreaming = computed(
  () => isStreaming.value && props.turn.text.length > 0,
)

const isStepThinking = (step: AgentStep, index: number): boolean => {
  if (!isStreaming.value || props.turn.text.length > 0) {
    return false
  }
  const isLastStep = index === props.turn.steps.length - 1
  return isLastStep
}
</script>

<template>
  <div class="flex w-full min-w-0 max-w-full flex-col gap-2">
    <AiElementsReasoningReasoning
      v-for="(step, index) in turn.steps"
      :key="step.id"
      :is-streaming="isStepThinking(step, index)"
      :default-open="isStepThinking(step, index)"
    >
      <AiElementsReasoningReasoningTrigger />
      <AiElementsReasoningReasoningContent :content="step.reasoning">
        <div
          v-if="step.tools.length > 0"
          class="mt-3 flex flex-col gap-0.5"
        >
          <ChatToolRun
            v-for="tool in step.tools"
            :key="tool.toolCallId"
            :run="tool"
          />
        </div>
      </AiElementsReasoningReasoningContent>
    </AiElementsReasoningReasoning>

    <AiElementsMessageMessageResponse
      v-if="turn.text"
      :content="turn.text"
      class="chat-markdown text-sm"
    />
    <div
      v-else-if="isTextStreaming"
      class="h-4 w-24 animate-pulse rounded-md bg-muted/40"
    />
  </div>
</template>
