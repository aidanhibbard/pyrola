<script setup lang="ts">
import { AppWindow, Globe, MessageSquare, Unlock } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const { state, openBrowserTab, unlock, openOwnerChat } = useChatBrowserLock()

const statusLabel = computed(() => {
  if (!state.value) {
    return ''
  }
  if (state.value.kind === 'owner') {
    return 'Using browser'
  }
  if (state.value.ownerTitle) {
    return `Waiting for browser (${state.value.ownerTitle})`
  }
  return 'Waiting for browser'
})
</script>

<template>
  <div
    v-if="state"
    class="flex w-full min-w-0 items-center gap-0.5"
  >
    <Tooltip>
      <TooltipTrigger as-child>
        <span
          class="inline-flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground"
          tabindex="0"
          :aria-label="statusLabel"
        >
          <AppWindow class="h-4 w-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent class="z-60">{{ statusLabel }}</TooltipContent>
    </Tooltip>
    <div class="ml-auto flex shrink-0 items-center gap-0.5">
      <Tooltip v-if="state.kind === 'owner'">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7"
            type="button"
            aria-label="Open browser tab"
            @click="openBrowserTab"
          >
            <Globe class="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent class="z-60">Open browser tab</TooltipContent>
      </Tooltip>
      <Tooltip v-if="state.kind === 'owner'">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7"
            type="button"
            aria-label="Unlock"
            @click="unlock"
          >
            <Unlock class="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent class="z-60">Unlock</TooltipContent>
      </Tooltip>
      <Tooltip v-if="state.kind === 'queued' && state.ownerChatId">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7"
            type="button"
            aria-label="Open chat"
            @click="openOwnerChat"
          >
            <MessageSquare class="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent class="z-60">Open chat</TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>
