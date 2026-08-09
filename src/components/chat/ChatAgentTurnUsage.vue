<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { AlertTriangle } from '@lucide/vue'
import type { BillableUsageRecord } from '@/types/billing/billable-usage-record'
import type { TurnUsageAggregate } from '@/types/billing/turn-usage-aggregate'
import useAgentHarness from '@/composables/use-agent-harness'
import useChatStore from '@/composables/use-chat-store'
import useFleetRegistry from '@/composables/use-fleet-registry'
import { HOME_CHAT_SLUG, isHomeChatSlug } from '@/constants/home-chat'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'

const props = defineProps<{
  turnId: string
}>()

const route = useRoute()
const chatStore = useChatStore()
const fleet = useFleetRegistry()

const isStandalone =
  route.name === 'home-chat' ||
  route.name === 'home-chat-subagent' ||
  isHomeChatSlug(String(route.params.slug ?? ''))

const projectSlug = isStandalone
  ? HOME_CHAT_SLUG
  : String(route.params.slug ?? '')
const chatId = String(route.params.chatId ?? '')

const sessionMeta = chatStore.forChat(projectSlug, chatId).meta.value
const project = fleet.projects.value.find((item) => item.slug === projectSlug)

const harness = useAgentHarness({
  projectSlug,
  chatId,
  projectRoot: sessionMeta?.projectRoot ?? project?.rootPath ?? '',
  projectName: isStandalone ? 'Home' : (project?.name ?? projectSlug),
  standalone: isStandalone,
})

const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact' })

const formatTokens = (tokens: number): string => compactFormatter.format(tokens)

const formatCostUsd = (cost: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(cost)

const aggregate = computed((): TurnUsageAggregate | null => {
  if (!chatId || !props.turnId) {
    return null
  }
  return harness.turnUsageByTurnId.value[props.turnId] ?? null
})

const costLabel = computed(() => {
  const usage = aggregate.value
  if (!usage || usage.costUSD === null) {
    return 'Cost unknown'
  }
  return formatCostUsd(usage.costUSD)
})

const tokenSummary = computed(() => {
  const usage = aggregate.value
  if (!usage) {
    return ''
  }
  const parts = [
    `${formatTokens(usage.inputTokens)}in`,
    `${formatTokens(usage.outputTokens)}out`,
  ]
  if (usage.cacheReadTokens > 0) {
    parts.push(`${formatTokens(usage.cacheReadTokens)} cache read`)
  }
  if (usage.cacheWriteTokens > 0) {
    parts.push(`${formatTokens(usage.cacheWriteTokens)} cache write`)
  }
  return parts.join(' ')
})

const showWarning = computed(() => {
  const usage = aggregate.value
  if (!usage) {
    return false
  }
  return usage.usageMissing || !usage.pricingComplete
})

const warningText = computed(() => {
  const usage = aggregate.value
  if (!usage) {
    return ''
  }
  if (usage.usageMissing) {
    return 'Provider did not return usage'
  }
  if (!usage.pricingComplete) {
    return 'Cost unknown'
  }
  return ''
})

const partLabel = (part: BillableUsageRecord): string => {
  if (part.source === 'main') {
    return 'Main'
  }
  if (part.source === 'subagent') {
    if (part.subagentId) {
      const subagent = chatStore.forChat(projectSlug, chatId).getSubagent(part.subagentId)
      const name = subagent?.name?.trim()
      if (name) {
        return `Subagent ${name}`
      }
    }
    return 'Subagent'
  }
  if (part.source === 'compaction') {
    return 'Compaction'
  }
  if (part.source === 'title') {
    return 'Title'
  }
  return 'Other'
}

const partCostLabel = (part: BillableUsageRecord): string => {
  if (part.costUSD === null) {
    return 'Cost unknown'
  }
  return formatCostUsd(part.costUSD)
}

const partTokenSummary = (part: BillableUsageRecord): string => {
  const input = part.usage.inputTokens ?? 0
  const output = part.usage.outputTokens ?? 0
  const cacheRead = part.usage.cacheReadTokens ?? 0
  const cacheWrite = part.usage.cacheWriteTokens ?? 0
  const parts = [`${formatTokens(input)}in`, `${formatTokens(output)}out`]
  if (cacheRead > 0) {
    parts.push(`${formatTokens(cacheRead)} cache read`)
  }
  if (cacheWrite > 0) {
    parts.push(`${formatTokens(cacheWrite)} cache write`)
  }
  return parts.join(' ')
}

const showTooltip = computed(
  () => showWarning.value || (aggregate.value?.parts.length ?? 0) > 0,
)
</script>

<template>
  <div
    v-if="aggregate"
    class="flex max-w-prose items-center gap-1.5 text-xs text-muted-foreground"
  >
    <Tooltip v-if="showTooltip">
      <TooltipTrigger as-child>
        <div class="inline-flex min-w-0 items-center gap-1.5">
          <span class="tabular-nums">{{ costLabel }}</span>
          <span
            v-if="tokenSummary"
            class="tabular-nums"
          >
            {{ tokenSummary }}
          </span>
          <AlertTriangle
            v-if="showWarning"
            class="size-3 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent class="max-w-xs space-y-1.5">
        <p
          v-if="warningText"
          class="font-medium"
        >
          {{ warningText }}
        </p>
        <ul
          v-if="aggregate.parts.length > 0"
          class="space-y-1"
        >
          <li
            v-for="part in aggregate.parts"
            :key="part.id"
            class="flex flex-col gap-0.5"
          >
            <span class="font-medium">{{ partLabel(part) }}</span>
            <span class="tabular-nums text-muted-foreground">
              {{ partCostLabel(part) }}
              {{ partTokenSummary(part) }}
            </span>
          </li>
        </ul>
      </TooltipContent>
    </Tooltip>
    <template v-else>
      <span class="tabular-nums">{{ costLabel }}</span>
      <span
        v-if="tokenSummary"
        class="tabular-nums"
      >
        {{ tokenSummary }}
      </span>
    </template>
  </div>
</template>
