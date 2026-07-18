<script setup lang="ts">
import { computed } from 'vue'
import resolveFileIcon from '@/utils/resolve-file-icon'

const props = defineProps<{
  name: string
  isDirectory?: boolean
  isOpen?: boolean
}>()

const icon = computed(() =>
  resolveFileIcon(props.name, {
    isDirectory: props.isDirectory ?? false,
    isOpen: props.isOpen ?? false,
  }),
)
</script>

<template>
  <img
    v-if="icon"
    :src="icon.src"
    alt=""
    class="size-4 shrink-0"
    draggable="false"
  />
</template>
