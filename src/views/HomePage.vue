<script setup lang="ts">
import ChatHomeEmptyChatInput from '@/components/chat/HomeEmptyChatInput.vue'
import { Empty } from '@/components/shadcn/ui/empty'
</script>

<template>
  <Empty class="min-h-[calc(100svh-40px)] w-full items-stretch px-6 md:px-10">
    <ChatHomeEmptyChatInput />
  </Empty>
</template>
