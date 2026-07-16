<script setup lang="ts">
import { Button } from '@/components/shadcn/ui/button'

const emit = defineEmits<{
  approve: []
  reject: []
}>()
</script>

<template>
  <div class="flex gap-2">
    <Button size="sm" @click="emit('approve')">
      Approve
    </Button>
    <Button size="sm" variant="outline" @click="emit('reject')">
      Reject
    </Button>
  </div>
</template>
