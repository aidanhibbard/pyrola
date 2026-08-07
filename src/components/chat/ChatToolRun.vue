<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRightIcon, LoaderCircleIcon, XIcon } from '@lucide/vue'
import type { ToolRun } from '@/types/harness/tool-run'
import type { FileDiff } from '@/types/harness/file-diff'
import countDiffLines from '@/utils/count-diff-lines'
import formatToolRunLabel from '@/utils/format-tool-run-label'
import resolveFileDiffHunks from '@/utils/resolve-file-diff-hunks'
import ChatArtifactLink from '@/components/chat/ChatArtifactLink.vue'
import ChatInlineFileDiff from '@/components/chat/InlineFileDiff.vue'
import {
  CommitFileAdditions,
  CommitFileDeletions,
} from '@/components/ai-elements/commit'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/ui/collapsible'

const props = defineProps<{
  run: ToolRun
}>()

const formatDetail = (value: unknown): string => {
  if (value === undefined) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const open = ref(false)

const hasArtifactChip = computed(
  () => props.run.artifact !== undefined && props.run.status === 'done',
)
const label = computed(() =>
  formatToolRunLabel(props.run, {
    omitPathHint: hasArtifactChip.value,
  }),
)
const isRunning = computed(() => props.run.status === 'running')
const isError = computed(() => props.run.status === 'error')
const hasDetails = computed(
  () => props.run.args !== undefined || props.run.result !== undefined,
)
const diffs = computed((): FileDiff[] => props.run.diffs ?? [])
const hasDiffs = computed(
  () => diffs.value.length > 0 && props.run.status === 'done',
)
const showInput = computed(
  () => props.run.args !== undefined && !hasDiffs.value,
)
const argsText = computed(() =>
  showInput.value ? formatDetail(props.run.args) : '',
)
const resultText = computed(() => formatDetail(props.run.result))
const showRawOutput = computed(
  () =>
    resultText.value.length > 0 &&
    (props.run.status === 'done' || props.run.status === 'error') &&
    diffs.value.length === 0,
)
const diffCounts = computed(() => {
  let additions = 0
  let deletions = 0
  for (const diff of diffs.value) {
    const counts = countDiffLines(resolveFileDiffHunks(diff))
    additions += counts.additions
    deletions += counts.deletions
  }
  return { additions, deletions }
})
</script>

<template>
  <Collapsible
    v-model:open="open"
    class="w-full min-w-0 max-w-full"
  >
    <CollapsibleTrigger
      class="flex w-full max-w-full cursor-pointer items-center gap-2 rounded-md py-0.5 text-left text-sm transition-colors hover:text-foreground"
      :class="isError ? 'text-destructive/90' : 'text-muted-foreground'"
    >
      <LoaderCircleIcon
        v-if="isRunning"
        class="size-3.5 shrink-0 animate-spin"
      />
      <XIcon
        v-else-if="isError"
        class="size-3.5 shrink-0 text-destructive"
      />
      <ChevronRightIcon
        v-else
        class="size-3.5 shrink-0 transition-transform"
        :class="open ? 'rotate-90' : ''"
      />
      <span class="shrink-0">{{ label }}</span>
      <ChatArtifactLink
        v-if="run.artifact && hasArtifactChip"
        :artifact="run.artifact"
      />
      <span
        v-if="hasDiffs && (diffCounts.additions > 0 || diffCounts.deletions > 0)"
        class="flex shrink-0 items-center gap-1.5 tabular-nums"
      >
        <CommitFileAdditions
          :count="diffCounts.additions"
          class="inline-flex items-center gap-0.5 text-[11px]"
        />
        <CommitFileDeletions
          :count="diffCounts.deletions"
          class="inline-flex items-center gap-0.5 text-[11px]"
        />
      </span>
    </CollapsibleTrigger>
    <CollapsibleContent
      class="mt-1 space-y-2 border-l border-border/60 pl-5 text-xs text-muted-foreground"
    >
      <p
        v-if="isRunning && !hasDetails"
        class="text-muted-foreground"
      >
        Running…
      </p>
      <div v-if="argsText">
        <p class="mb-1 font-medium text-foreground/80">
          Input
        </p>
        <pre class="max-h-40 overflow-auto whitespace-pre-wrap wrap-break-word">{{ argsText }}</pre>
      </div>
      <div
        v-if="hasDiffs"
        class="space-y-2"
      >
        <ChatInlineFileDiff
          v-for="diff in diffs"
          :key="diff.path"
          :diff="diff"
        />
      </div>
      <div v-if="showRawOutput">
        <p class="mb-1 font-medium text-foreground/80">
          Output
        </p>
        <pre class="max-h-48 overflow-auto whitespace-pre-wrap wrap-break-word">{{ resultText }}</pre>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
