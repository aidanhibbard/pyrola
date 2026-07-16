<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/shadcn/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/shadcn/ui/popover'
import { Progress } from '@/components/shadcn/ui/progress'
import type { ContextBucket } from '@/types/harness/context-bucket'
import { CONTEXT_BUCKET_META } from '@/types/harness/context-bucket-meta'
import useContextUsage from '@/composables/use-context-usage'

withDefaults(
  defineProps<{
    triggerDisabled?: boolean
  }>(),
  {
    triggerDisabled: false,
  },
)

const contextUsage = useContextUsage()
const open = ref(false)

const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact' })

const usedTokens = computed(() => contextUsage.used.value)
const maxTokens = computed(() => contextUsage.limit.value)
const ratio = computed(() => contextUsage.ratio.value)

const percentLabel = computed(() =>
  new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(ratio.value),
)

const usedLabel = computed(() => compactFormatter.format(usedTokens.value))
const limitLabel = computed(() => compactFormatter.format(maxTokens.value))

const statusClass = computed(() => {
  if (ratio.value >= 0.95) {
    return 'text-destructive'
  }
  if (ratio.value >= 0.8) {
    return 'text-amber-600 dark:text-amber-400'
  }
  return 'text-muted-foreground'
})

const visibleBuckets = computed(() => contextUsage.visibleBuckets.value)

const ringDashOffset = computed(() => {
  const circumference = 2 * Math.PI * 10
  return circumference * (1 - ratio.value)
})

const bucketShare = (bucket: ContextBucket): number => {
  if (usedTokens.value <= 0) {
    return 0
  }
  return (bucket.tokens / usedTokens.value) * 100
}

const bucketColorClass = (bucket: ContextBucket): string =>
  CONTEXT_BUCKET_META[bucket.id].colorClass

const formatBucketTokens = (tokens: number): string =>
  compactFormatter.format(tokens)
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="h-7 gap-1.5 px-2 text-xs"
        :class="statusClass"
        :disabled="triggerDisabled || contextUsage.pending.value"
      >
        <span class="font-medium tabular-nums">
          {{ percentLabel }}
        </span>
        <svg
          aria-hidden="true"
          class="size-5 shrink-0"
          viewBox="0 0 24 24"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="opacity-25"
          />
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            class="opacity-80"
            :stroke-dasharray="`${2 * Math.PI * 10} ${2 * Math.PI * 10}`"
            :stroke-dashoffset="ringDashOffset"
            style="transform: rotate(-90deg); transform-origin: center"
          />
        </svg>
      </Button>
    </PopoverTrigger>

    <PopoverContent align="end" class="w-80 divide-y overflow-hidden p-0">
      <div class="space-y-2 p-3">
        <div class="flex items-center justify-between gap-3 text-xs">
          <p class="font-medium">
            Context usage
          </p>
          <p class="font-mono text-muted-foreground">
            {{ usedLabel }} / {{ limitLabel }}
          </p>
        </div>
        <div class="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>{{ percentLabel }} full</p>
        </div>
        <Progress :model-value="ratio * 100" class="h-1.5 bg-muted" />
      </div>

      <div class="space-y-3 p-3">
        <div
          v-if="visibleBuckets.length > 0"
          class="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            v-for="bucket in visibleBuckets"
            :key="bucket.id"
            :class="bucketColorClass(bucket)"
            :style="{ width: `${bucketShare(bucket)}%` }"
            :title="`${bucket.label}: ${formatBucketTokens(bucket.tokens)}`"
          />
        </div>

        <ul class="space-y-2">
          <li
            v-for="bucket in visibleBuckets"
            :key="bucket.id"
            class="flex items-center justify-between gap-3 text-xs"
          >
            <span class="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span
                class="size-2 shrink-0 rounded-full"
                :class="bucketColorClass(bucket)"
              />
              <span class="truncate">{{ bucket.label }}</span>
            </span>
            <span class="shrink-0 font-mono tabular-nums text-foreground">
              {{ formatBucketTokens(bucket.tokens) }}
            </span>
          </li>
        </ul>

        <p
          v-if="visibleBuckets.length === 0"
          class="text-xs text-muted-foreground"
        >
          No context counted yet. Select a model to estimate usage.
        </p>
      </div>
    </PopoverContent>
  </Popover>
</template>
