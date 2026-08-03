<script setup lang="ts">
import type { HTMLAttributes, Ref } from 'vue'
import { cn } from '@/lib/utils'
import { useVModel } from '@vueuse/core'
import { provide, ref, watch } from 'vue'
import { ChainOfThoughtContextKey } from './context'

interface ChainOfThoughtProps {
  modelValue?: boolean
  defaultOpen?: boolean
  isStreaming?: boolean
  class?: HTMLAttributes['class']
}

const props = withDefaults(
  defineProps<ChainOfThoughtProps>(),
  {
    defaultOpen: false,
    modelValue: undefined,
    isStreaming: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const isOpen = useVModel(props, 'modelValue', emit, {
  defaultValue: props.defaultOpen,
  passive: true,
})

const hasAutoClosed = ref(false)
const wasStreaming = ref(false)
const AUTO_CLOSE_DELAY = 1000

watch(() => props.isStreaming, (streaming, _prev, onCleanup) => {
  if (streaming) {
    wasStreaming.value = true
    isOpen.value = true
    return
  }

  if (!wasStreaming.value) {
    return
  }

  if (!hasAutoClosed.value && isOpen.value) {
    const timer = setTimeout(() => {
      isOpen.value = false
      hasAutoClosed.value = true
    }, AUTO_CLOSE_DELAY)

    onCleanup(() => clearTimeout(timer))
  }
}, { immediate: true })

provide(ChainOfThoughtContextKey, isOpen as Ref<boolean>)
</script>

<template>
  <div
    :class="cn('not-prose max-w-prose', props.class)"
    v-bind="$attrs"
  >
    <slot />
  </div>
</template>
