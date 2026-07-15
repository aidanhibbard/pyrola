<script setup lang="ts">
import { DialogTrigger } from '@/components/ui/dialog'

type VoiceSelectorTriggerProps = InstanceType<typeof DialogTrigger>['$props']

interface Props extends /* @vue-ignore */ VoiceSelectorTriggerProps {}

defineProps<Props>()
</script>

<template>
  <DialogTrigger>
    <slot />
  </DialogTrigger>
</template>
