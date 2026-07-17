<script setup lang="ts">
import { Badge } from '@/components/shadcn/ui/badge'

defineProps<{
  label?: string
  tone?: 'default' | 'secondary' | 'outline' | 'destructive'
}>()
</script>

<template>
  <Badge :variant="tone ?? 'secondary'">{{ label }}</Badge>
</template>
