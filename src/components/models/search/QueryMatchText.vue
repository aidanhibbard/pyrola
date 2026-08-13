<script setup lang="ts">
import highlightQueryMatches from '@/utils/highlight-query-matches'

const props = withDefaults(
  defineProps<{
    text: string
    query: string
    unmatchedClass?: string
  }>(),
  {
    unmatchedClass: '',
  },
)

const segments = computed(() => highlightQueryMatches(props.text, props.query))
</script>

<template>
  <span
    v-for="(segment, index) in segments"
    :key="index"
    :class="segment.matched ? 'chat-mention-match' : unmatchedClass"
  >{{ segment.text }}</span>
</template>
