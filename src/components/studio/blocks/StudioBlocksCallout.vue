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
    <AlertDescription class="text-sm leading-6 text-muted-foreground [&_p]:text-sm [&_p]:leading-6">
      <slot />
    </AlertDescription>
  </Alert>
</template>
