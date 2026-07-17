<script setup lang="ts">
import { computed } from 'vue'
import type { ChatStatus } from 'ai'
import type { AgentStep } from '@/types/chat/agent-step'
import type { AgentTurn } from '@/types/chat/agent-turn'
import AiElementsMessageMessageResponse from '@/components/ai-elements/message/MessageResponse.vue'
import ChatAgentStepRoll from '@/components/chat/ChatAgentStepRoll.vue'

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

const visibleSteps = computed(() =>
  props.turn.steps.filter(
    (step) =>
      step.text.trim().length > 0 ||
      step.reasoning.trim().length > 0 ||
      step.tools.length > 0,
  ),
)

const stepText = (step: AgentStep): string => step.text.trim()

const isStepStreaming = (index: number): boolean => {
  if (!isStreaming.value) {
    return false
  }
  return index === visibleSteps.value.length - 1 && props.turn.text.length === 0
}
</script>

<template>
  <div class="flex w-full min-w-0 max-w-full flex-col gap-4">
    <template
      v-for="(step, index) in visibleSteps"
      :key="step.id"
    >
      <AiElementsMessageMessageResponse
        v-if="stepText(step)"
        :content="stepText(step)"
        class="chat-markdown text-sm"
      />
      <ChatAgentStepRoll
        :step="step"
        :is-streaming="isStepStreaming(index)"
      />
    </template>

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
