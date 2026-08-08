<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { PendingMcpAuthView } from '@/types/chat/pending-mcp-auth'
import { Button } from '@/components/shadcn/ui/button'
import { Marker, MarkerContent } from '@/components/shadcn/ui/marker'

const props = defineProps<{
  auth: PendingMcpAuthView
}>()

const emit = defineEmits<{
  authenticate: [toolCallId: string]
  skip: [toolCallId: string]
  openSettings: [serverId: string]
}>()

const handleAuthenticate = (): void => {
  try {
    emit('authenticate', props.auth.toolCallId)
  } catch (error) {
    toast.error('Failed to start authentication', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleSkip = (): void => {
  try {
    emit('skip', props.auth.toolCallId)
  } catch (error) {
    toast.error('Failed to skip authentication', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleOpenSettings = (): void => {
  try {
    emit('openSettings', props.auth.serverId)
  } catch (error) {
    toast.error('Failed to open settings', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
</script>

<template>
  <div class="w-full space-y-3">
    <Marker variant="border" class="w-full">
      <MarkerContent>
        Waiting for MCP authentication
      </MarkerContent>
    </Marker>
    <div class="space-y-1">
      <p class="text-sm font-medium text-foreground">
        {{ auth.title }}
      </p>
      <p class="font-mono text-xs text-muted-foreground">
        {{ auth.serverId }}
      </p>
      <p
        v-if="auth.detail"
        class="text-sm text-muted-foreground"
      >
        {{ auth.detail }}
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <Button
        size="sm"
        @click="handleAuthenticate"
      >
        Authenticate
      </Button>
      <Button
        size="sm"
        variant="outline"
        @click="handleSkip"
      >
        Skip
      </Button>
      <Button
        size="sm"
        variant="ghost"
        @click="handleOpenSettings"
      >
        Open in Settings
      </Button>
    </div>
  </div>
</template>
