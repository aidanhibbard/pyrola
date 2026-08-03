<script setup lang="ts">
import { computed } from 'vue'
import type { ChatStatus } from 'ai'
import { RotateCcwIcon } from '@lucide/vue'
import type { AgentStep } from '@/types/chat/agent-step'
import type { AgentTurn } from '@/types/chat/agent-turn'
import AiElementsChainOfThoughtChainOfThought from '@/components/ai-elements/chain-of-thought/ChainOfThought.vue'
import AiElementsChainOfThoughtChainOfThoughtContent from '@/components/ai-elements/chain-of-thought/ChainOfThoughtContent.vue'
import AiElementsChainOfThoughtChainOfThoughtHeader from '@/components/ai-elements/chain-of-thought/ChainOfThoughtHeader.vue'
import AiElementsMessageMessage from '@/components/ai-elements/message/Message.vue'
import AiElementsMessageMessageResponse from '@/components/ai-elements/message/MessageResponse.vue'
import AiElementsReasoningReasoning from '@/components/ai-elements/reasoning/Reasoning.vue'
import AiElementsReasoningReasoningContent from '@/components/ai-elements/reasoning/ReasoningContent.vue'
import AiElementsReasoningReasoningTrigger from '@/components/ai-elements/reasoning/ReasoningTrigger.vue'
import AiElementsShimmerShimmer from '@/components/ai-elements/shimmer/Shimmer.vue'
import ChatToolRun from '@/components/chat/ChatToolRun.vue'
import { Button } from '@/components/shadcn/ui/button'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/shadcn/ui/alert'

const props = defineProps<{
  turn: AgentTurn
  status?: ChatStatus
}>()

const emit = defineEmits<{
  retry: []
}>()

const isStreaming = computed(
  () => props.status === 'streaming' || props.status === 'submitted',
)

const stepEntries = computed(() =>
  props.turn.steps.map((step, index) => ({ step, index })),
)

const hasVisibleContent = computed(() =>
  props.turn.steps.some(
    (step) =>
      step.reasoning.trim().length > 0 ||
      step.text.trim().length > 0 ||
      step.tools.length > 0,
  ) || props.turn.text.trim().length > 0,
)

const isPendingAck = computed(() => isStreaming.value && !hasVisibleContent.value)

const isStepStreaming = (index: number): boolean => {
  if (!isStreaming.value) {
    return false
  }
  return index === props.turn.steps.length - 1
}

const toolHeaderLabel = (step: AgentStep, index: number): string => {
  const count = step.tools.length
  if (isStepStreaming(index)) {
    return count === 1 ? 'Using tool' : `Using ${count} tools`
  }
  return `Used ${count} tool${count === 1 ? '' : 's'}`
}

const errorTitle = computed(() => {
  const kind = props.turn.error?.kind
  if (kind === 'timeout') {
    return 'Timed out'
  }
  if (kind === 'aborted') {
    return 'Stopped'
  }
  return 'Something went wrong'
})
</script>

<template>
  <div class="flex w-full min-w-0 max-w-full flex-col gap-4">
    <AiElementsShimmerShimmer
      v-if="isPendingAck"
      :duration="1.5"
      as="p"
      class="text-sm"
    >
      Processing…
    </AiElementsShimmerShimmer>

    <!--
      AI SDK parts order per step: reasoning → text → tools.
      Rendering chronologically avoids tools jumping above earlier text.
    -->
    <template
      v-for="{ step, index } in stepEntries"
      :key="step.id"
    >
      <AiElementsReasoningReasoning
        v-if="step.reasoning.trim().length > 0"
        :is-streaming="isStepStreaming(index) && step.text.trim().length === 0 && step.tools.length === 0"
        :default-open="isStepStreaming(index) && step.text.trim().length === 0 && step.tools.length === 0"
        class="mb-0 w-full max-w-prose"
      >
        <AiElementsReasoningReasoningTrigger />
        <AiElementsReasoningReasoningContent
          :content="step.reasoning"
          class="max-w-prose"
        />
      </AiElementsReasoningReasoning>

      <AiElementsMessageMessage
        v-if="step.text.trim().length > 0"
        from="assistant"
        class="max-w-full"
      >
        <AiElementsMessageMessageResponse
          :content="step.text"
          class="chat-markdown text-sm"
        />
      </AiElementsMessageMessage>

      <AiElementsChainOfThoughtChainOfThought
        v-if="step.tools.length > 0"
        :default-open="isStepStreaming(index)"
        class="w-full max-w-full"
      >
        <AiElementsChainOfThoughtChainOfThoughtHeader>
          <AiElementsShimmerShimmer
            v-if="isStepStreaming(index)"
            :duration="1"
            as="span"
          >
            {{ toolHeaderLabel(step, index) }}
          </AiElementsShimmerShimmer>
          <span v-else>{{ toolHeaderLabel(step, index) }}</span>
        </AiElementsChainOfThoughtChainOfThoughtHeader>
        <AiElementsChainOfThoughtChainOfThoughtContent class="space-y-2">
          <div class="flex flex-col gap-0.5">
            <ChatToolRun
              v-for="tool in step.tools"
              :key="tool.toolCallId"
              :run="tool"
            />
          </div>
        </AiElementsChainOfThoughtChainOfThoughtContent>
      </AiElementsChainOfThoughtChainOfThought>
    </template>

    <AiElementsMessageMessage
      v-if="turn.text.trim().length > 0"
      from="assistant"
      class="max-w-full"
    >
      <AiElementsMessageMessageResponse
        :content="turn.text"
        class="chat-markdown text-sm"
      />
    </AiElementsMessageMessage>

    <Alert
      v-if="turn.error"
      variant="destructive"
      class="max-w-xl"
    >
      <AlertTitle>{{ errorTitle }}</AlertTitle>
      <AlertDescription class="flex flex-col gap-3">
        <span>{{ turn.error.message }}</span>
        <Button
          v-if="turn.error.kind !== 'aborted'"
          type="button"
          variant="outline"
          size="sm"
          class="w-fit gap-1.5"
          @click="emit('retry')"
        >
          <RotateCcwIcon class="size-3.5" />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  </div>
</template>
