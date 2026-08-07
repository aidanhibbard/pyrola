<script setup lang="ts">
const DOT_COLORS = [
  '#D4C1EC',
  '#B5D8F0',
  '#C5E8D0',
  '#F5C6D6',
  '#C9C0F0',
  '#C5E4F5',
  '#F8D5C2',
  '#BFE5D8',
  '#C8CFF5',
] as const
</script>

<template>
  <span
    class="chat-running-dots inline-grid shrink-0"
    role="img"
    aria-label="Running"
  >
    <span
      v-for="(color, index) in DOT_COLORS"
      :key="index"
      class="chat-running-dots__dot"
      :style="{
        backgroundColor: color,
        animationDelay: `${index * 100}ms`,
      }"
    />
  </span>
</template>
