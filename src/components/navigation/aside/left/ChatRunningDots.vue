<script setup lang="ts">
/** Soft LTR wave: left column leads, then middle, then right. */
const DOTS = [
  { color: '#D4C1EC', delayMs: 0 },
  { color: '#B5D8F0', delayMs: 160 },
  { color: '#C5E8D0', delayMs: 320 },
  { color: '#F5C6D6', delayMs: 0 },
  { color: '#C9C0F0', delayMs: 160 },
  { color: '#C5E4F5', delayMs: 320 },
  { color: '#F8D5C2', delayMs: 0 },
  { color: '#BFE5D8', delayMs: 160 },
  { color: '#C8CFF5', delayMs: 320 },
] as const
</script>

<template>
  <span
    class="chat-running-dots inline-grid shrink-0"
    role="img"
    aria-label="Running"
  >
    <span
      v-for="(dot, index) in DOTS"
      :key="index"
      class="chat-running-dots__dot"
      :style="{
        backgroundColor: dot.color,
        animationDelay: `${dot.delayMs}ms`,
      }"
    />
  </span>
</template>
