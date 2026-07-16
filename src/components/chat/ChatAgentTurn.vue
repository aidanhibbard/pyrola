<script setup lang="ts">
import { computed } from 'vue'
import type { ChatStatus } from 'ai'
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

const hasStepActivity = computed(() =>
  props.turn.steps.some(
    (step) => step.reasoning.length > 0 || step.tools.length > 0,
  ),
)

const combinedReasoning = computed(() =>
  props.turn.steps
    .map((step) => step.reasoning.trim())
    .filter((reasoning) => reasoning.length > 0)
    .join('\n\n'),
)

const isThinking = computed(
  () => isStreaming.value && props.turn.text.length === 0 && hasStepActivity.value,
)
</script>

<template>
  <div class="flex w-full min-w-0 max-w-full flex-col gap-2">
    <AiElementsReasoningReasoning
      v-if="hasStepActivity"
      :is-streaming="isThinking"
      :default-open="isThinking"
    >
      <AiElementsReasoningReasoningTrigger />
      <AiElementsReasoningReasoningContent :content="combinedReasoning">
        <div
          v-for="step in turn.steps"
          :key="step.id"
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
