<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from '@/components/shadcn/ui/alert'

defineProps<{
  tone?: 'default' | 'info' | 'warning' | 'destructive'
  title?: string
}>()
</script>

<template>
  <Alert
    :variant="tone === 'destructive' ? 'destructive' : 'default'"
    class="border-border/50"
  >
    <AlertTitle v-if="title">{{ title }}</AlertTitle>
    <AlertDescription class="prose prose-sm dark:prose-invert max-w-none">
      <slot />
    </AlertDescription>
  </Alert>
</template>
