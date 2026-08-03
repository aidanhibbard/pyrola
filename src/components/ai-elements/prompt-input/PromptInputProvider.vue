<script setup lang="ts">
import type { PromptInputMessage } from './types'
import { getCurrentInstance } from 'vue'
import { toast } from 'vue-sonner'
import { usePromptInputProvider } from './context'

const props = defineProps<{
  initialInput?: string
  maxFiles?: number
  maxFileSize?: number
  accept?: string
}>()

const emit = defineEmits<{
  (e: 'submit', payload: PromptInputMessage): void
  (e: 'error', payload: { code: string, message: string }): void
}>()

const instance = getCurrentInstance()

function getListener(name: 'onSubmit' | 'onError') {
  return instance?.vnode.props?.[name]
}

function callListener<T>(listener: unknown, payload: T) {
  if (Array.isArray(listener)) {
    return Promise.all(listener.map(fn => typeof fn === 'function' ? fn(payload) : undefined))
  }

  if (typeof listener === 'function') {
    return listener(payload)
  }
}

usePromptInputProvider({
  initialInput: props.initialInput,
  maxFiles: props.maxFiles,
  maxFileSize: props.maxFileSize,
  accept: props.accept,
  onSubmit: (msg) => {
    const listener = getListener('onSubmit')
    if (listener)
      return callListener(listener, msg)

    emit('submit', msg)
  },
  onError: (err) => {
    const listener = getListener('onError')
    if (listener) {
      Promise.resolve(callListener(listener, err)).catch((error) => {
        toast.error('Prompt input error handler failed', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
      return
    }

    emit('error', err)
  },
})
</script>

<template>
  <slot />
</template>
