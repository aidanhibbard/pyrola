<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRightIcon } from '@lucide/vue'
import type { AgentStep } from '@/types/chat/agent-step'
import summarizeStepTools from '@/utils/summarize-step-tools'
import AiElementsReasoningReasoning from '@/components/ai-elements/reasoning/Reasoning.vue'
import AiElementsReasoningReasoningContent from '@/components/ai-elements/reasoning/ReasoningContent.vue'
import AiElementsReasoningReasoningTrigger from '@/components/ai-elements/reasoning/ReasoningTrigger.vue'
import ChatToolRun from '@/components/chat/ChatToolRun.vue'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/ui/collapsible'

const props = defineProps<{
  step: AgentStep
  isStreaming?: boolean
}>()

const open = ref(false)

const reasoning = computed(() => props.step.reasoning.trim())
const hasReasoning = computed(() => reasoning.value.length > 0)
const hasTools = computed(() => props.step.tools.length > 0)
const summary = computed(() => summarizeStepTools(props.step.tools))
const isToolStreaming = computed(
  () => props.isStreaming && props.step.tools.some((tool) => tool.status === 'running'),
)
const defaultReasoningOpen = computed(
  () => props.isStreaming && hasReasoning.value && isToolStreaming.value,
)
</script>

<template>
  <AiElementsReasoningReasoning
    v-if="hasReasoning"
    :is-streaming="isToolStreaming"
    :default-open="defaultReasoningOpen"
    class="mb-0"
  >
    <AiElementsReasoningReasoningTrigger />
    <div
      v-if="hasTools"
      class="mt-1 flex flex-col gap-0.5"
    >
      <ChatToolRun
        v-for="tool in step.tools"
        :key="tool.toolCallId"
        :run="tool"
      />
    </div>
    <AiElementsReasoningReasoningContent :content="reasoning" />
  </AiElementsReasoningReasoning>

  <Collapsible
    v-else-if="hasTools"
    v-model:open="open"
    class="not-prose w-full min-w-0"
  >
    <CollapsibleTrigger
      class="flex w-full cursor-pointer items-center gap-2 rounded-md py-0.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronRightIcon
        class="size-3.5 shrink-0 transition-transform"
        :class="open ? 'rotate-90' : ''"
      />
      <span
        class="min-w-0 truncate"
        :class="isToolStreaming ? 'shimmer shimmer-duration-1000' : ''"
      >
        {{ summary }}
      </span>
    </CollapsibleTrigger>
    <CollapsibleContent class="mt-1 flex flex-col gap-0.5 border-l border-border/60 pl-3">
      <ChatToolRun
        v-for="tool in step.tools"
        :key="tool.toolCallId"
        :run="tool"
      />
    </CollapsibleContent>
  </Collapsible>
</template>
