<script setup lang="ts">
import { CommandSeparator } from '@/components/ui/command'

type VoiceSelectorSeparatorProps = InstanceType<typeof CommandSeparator>['$props']

interface Props extends /* @vue-ignore */ VoiceSelectorSeparatorProps {}

defineProps<Props>()
</script>

<template>
  <CommandSeparator>
    <slot />
  </CommandSeparator>
</template>
