<script setup lang="ts">
import { InputGroupAddon } from '@/components/ui/input-group'

type InputGroupAddonProps = InstanceType<typeof InputGroupAddon>['$props']

interface Props extends /* @vue-ignore */ InputGroupAddonProps {}

const props = defineProps<Props>()
</script>

<template>
  <InputGroupAddon v-bind="props">
    <slot />
  </InputGroupAddon>
</template>
