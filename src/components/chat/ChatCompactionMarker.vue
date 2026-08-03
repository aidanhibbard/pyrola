<script setup lang="ts">
defineProps<{
  summary: string
  focus: string | null
}>()
</script>

<template>
  <div class="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="shrink-0"
    >
      <path d="M3 6h18" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
    <span>Context compacted</span>
    <span
      v-if="focus && focus !== 'none'"
      class="text-muted-foreground/70"
    >· focus: {{ focus }}</span>
  </div>
</template>
