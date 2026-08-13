<script setup lang="ts">
import { Search } from '@lucide/vue'

withDefaults(
  defineProps<{
    placeholder?: string
  }>(),
  {
    placeholder: 'Search models...',
  },
)

const model = defineModel<string>({ default: '' })
</script>

<template>
  <div
    data-slot="command-input-wrapper"
    class="flex h-9 items-center gap-2 border-b px-3"
  >
    <Search class="size-4 shrink-0 opacity-50" />
    <input
      v-model="model"
      type="text"
      data-slot="command-input"
      autofocus
      :placeholder="placeholder"
      class="placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3.5 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
    >
  </div>
</template>
