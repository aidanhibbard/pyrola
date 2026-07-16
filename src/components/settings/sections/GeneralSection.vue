<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import { Input } from '@/components/shadcn/ui/input'
import { Label } from '@/components/shadcn/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/ui/dialog'
import usePyrolaConfig from '@/composables/use-pyrola-config'

const config = usePyrolaConfig()
const shortcutsOpen = ref(false)

const machineLabel = computed(
  () => config.personalSettings.value['general.machineLabel'] ?? 'This machine',
)

const updateMachineLabel = async (value: string | number): Promise<void> => {
  try {
    await config.setMachineLabel(String(value))
  } catch (error) {
    toast.error('Failed to save machine label', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const shortcuts = [
  { keys: 'Cmd/Ctrl+K', action: 'Command palette' },
  { keys: 'Cmd/Ctrl+N', action: 'New Agent' },
  { keys: 'Cmd/Ctrl+B', action: 'Toggle left sidebar' },
  { keys: 'Cmd/Ctrl+Shift+B', action: 'Toggle right workbench' },
  { keys: 'Ctrl+`', action: 'Toggle bottom terminal' },
  { keys: 'Esc', action: 'Leave Settings' },
]
</script>

<template>
  <section class="space-y-6">
    <h2 class="text-lg font-medium">General</h2>

    <div class="space-y-2">
      <Label>Machine label</Label>
      <Input
        :model-value="machineLabel"
        @update:model-value="updateMachineLabel"
      />
      <p class="text-sm text-muted-foreground">Shown in chat context bar</p>
    </div>

    <div class="space-y-2">
      <Label>Keyboard shortcuts</Label>
      <p class="text-sm text-muted-foreground">Cmd+K search, Cmd+N new agent, …</p>
      <Button variant="outline" size="sm" class="w-fit" @click="shortcutsOpen = true">
        View shortcuts
      </Button>
    </div>

    <Dialog :open="shortcutsOpen" @update:open="(open) => (shortcutsOpen = open)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div class="space-y-2 text-sm">
          <div
            v-for="shortcut in shortcuts"
            :key="shortcut.keys"
            class="flex justify-between gap-4"
          >
            <span class="font-mono">{{ shortcut.keys }}</span>
            <span class="text-muted-foreground">{{ shortcut.action }}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </section>
</template>
