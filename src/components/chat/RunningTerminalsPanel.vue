<script setup lang="ts">
import { SquareIcon, TerminalIcon } from '@lucide/vue'
import type { AgentShellRecord } from '@/types/harness/agent-shell'
import { Button } from '@/components/shadcn/ui/button'

defineProps<{
  shells: AgentShellRecord[]
}>()

const emit = defineEmits<{
  stopShell: [shellId: string]
}>()

const truncateCommand = (command: string, max = 60): string =>
  command.length > max ? `${command.slice(0, max)}…` : command
</script>

<template>
  <div
    v-if="shells.length > 0"
    class="mx-auto mb-2 w-full max-w-3xl rounded-lg border border-border/50 bg-muted/40 px-3 py-2"
  >
    <div class="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <TerminalIcon class="size-3" />
      <span>Running terminals</span>
    </div>
    <div class="flex flex-col gap-1">
      <div
        v-for="shell in shells"
        :key="shell.shellId"
        class="flex items-center gap-2"
      >
        <span class="min-w-0 flex-1 truncate font-mono text-xs text-foreground/80">
          {{ truncateCommand(shell.command) }}
        </span>
        <Button
          variant="ghost"
          size="icon"
          class="size-5 shrink-0 text-muted-foreground hover:text-foreground"
          title="Stop terminal"
          @click="emit('stopShell', shell.shellId)"
        >
          <SquareIcon class="size-3" />
        </Button>
      </div>
    </div>
  </div>
</template>
