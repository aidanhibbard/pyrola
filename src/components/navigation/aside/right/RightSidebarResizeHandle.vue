<script setup lang="ts">
import { ResizableHandle } from '@/components/shadcn/ui/resizable'

const passthroughSuspend = useBrowserPassthroughSuspend()
const isDragging = ref(false)

const handleDragging = (dragging: boolean): void => {
  if (dragging === isDragging.value) {
    return
  }
  isDragging.value = dragging
  if (dragging) {
    passthroughSuspend.suspend()
    return
  }
  passthroughSuspend.resume()
}

onBeforeUnmount(() => {
  if (isDragging.value) {
    passthroughSuspend.resume()
  }
})
</script>

<template>
  <ResizableHandle @dragging="handleDragging" />
</template>
