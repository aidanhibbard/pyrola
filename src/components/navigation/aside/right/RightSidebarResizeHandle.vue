<script setup lang="ts">
import { ResizableHandle } from '@/components/shadcn/ui/resizable'

const passthroughSuspend = useBrowserPassthroughSuspend()
const layoutHide = useBrowserLayoutHide()
const isDragging = ref(false)

const handleDragging = (dragging: boolean): void => {
  if (dragging === isDragging.value) {
    return
  }
  isDragging.value = dragging
  if (dragging) {
    passthroughSuspend.suspend()
    layoutHide.begin()
    return
  }
  passthroughSuspend.resume()
  layoutHide.end()
}

onBeforeUnmount(() => {
  if (isDragging.value) {
    passthroughSuspend.resume()
    layoutHide.end()
  }
})
</script>

<template>
  <ResizableHandle @dragging="handleDragging" />
</template>
