<script setup lang="ts">
import type { FileDiff } from '@/types/harness/file-diff'

defineProps<{
  diff: FileDiff
}>()
</script>

<template>
  <div class="overflow-hidden rounded-md border border-border/50 text-xs">
    <div class="border-b border-border/50 bg-muted/40 px-2 py-1 font-medium">
      {{ diff.path }}
    </div>
    <div class="max-h-64 overflow-auto p-2 font-mono">
      <div
        v-for="(hunk, hunkIndex) in diff.hunks"
        :key="hunkIndex"
        class="space-y-0"
      >
        <div
          v-for="(line, lineIndex) in hunk.lines"
          :key="`${hunkIndex}-${lineIndex}`"
          class="px-1"
          :class="{
            'bg-green-500/10 text-green-700 dark:text-green-400': line.kind === 'add',
            'bg-red-500/10 text-red-700 dark:text-red-400': line.kind === 'remove',
          }"
        >
          <span v-if="line.kind === 'add'">+</span>
          <span v-else-if="line.kind === 'remove'">-</span>
          <span v-else>&nbsp;</span>
          {{ line.content }}
        </div>
      </div>
    </div>
  </div>
</template>
