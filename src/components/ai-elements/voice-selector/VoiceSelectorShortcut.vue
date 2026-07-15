<script setup lang="ts">
import { CommandShortcut } from '@/components/ui/command'

type VoiceSelectorShortcutProps = InstanceType<typeof CommandShortcut>['$props']

interface Props extends /* @vue-ignore */ VoiceSelectorShortcutProps {}

defineProps<Props>()
</script>

<template>
  <CommandShortcut>
    <slot />
  </CommandShortcut>
</template>
