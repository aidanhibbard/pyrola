<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import { Input } from '@/components/shadcn/ui/input'
import { Label } from '@/components/shadcn/ui/label'
import { Progress } from '@/components/shadcn/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/ui/dialog'
import useAppUpdater from '@/composables/use-app-updater'
import usePyrolaConfig from '@/composables/use-pyrola-config'

const config = usePyrolaConfig()
const updater = useAppUpdater()
const shortcutsOpen = ref(false)

const machineLabel = computed(
  () => config.personalSettings.value['general.machineLabel'] ?? 'This machine',
)

const lastCheckedLabel = computed(() => {
  const at = updater.lastCheckedAt.value
  if (!at) {
    return null
  }
  return at.toLocaleString()
})

const downloadProgressPercent = computed(() => {
  const current = updater.progress.value
  if (!current || current.contentLength <= 0) {
    return 0
  }
  return Math.min(100, Math.round((current.downloaded / current.contentLength) * 100))
})

const downloadProgressLabel = computed(() => {
  const current = updater.progress.value
  if (!current) {
    return 'Downloading update...'
  }
  if (current.contentLength <= 0) {
    return `Downloading... ${current.downloaded} bytes`
  }
  return `${current.downloaded} / ${current.contentLength} bytes`
})

const updateMachineLabel = async (value: string | number): Promise<void> => {
  try {
    await config.setMachineLabel(String(value))
  } catch (error) {
    toast.error('Failed to save machine label', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleCheckForUpdates = async (): Promise<void> => {
  try {
    await updater.checkForUpdates({ silent: false })
  } catch (error) {
    toast.error('Failed to check for updates', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleDownloadAndRestart = async (): Promise<void> => {
  try {
    await updater.downloadAndInstall()
  } catch (error) {
    toast.error('Failed to install update', {
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

    <div class="space-y-2">
      <Label>Updates</Label>
      <p class="text-sm text-muted-foreground">
        Check for a new version. Install only when you choose to.
      </p>
      <Button
        variant="outline"
        size="sm"
        class="w-fit"
        :disabled="updater.checking.value"
        @click="handleCheckForUpdates"
      >
        {{ updater.checking.value ? 'Checking...' : 'Check for updates' }}
      </Button>

      <div
        v-if="updater.updateAvailable.value"
        class="space-y-3 rounded-md border border-border bg-muted/30 p-3"
      >
        <p class="text-sm font-medium">
          Update available: v{{ updater.updateAvailable.value.version }}
        </p>
        <p
          v-if="updater.updateAvailable.value.body"
          class="whitespace-pre-wrap text-sm text-muted-foreground"
        >
          {{ updater.updateAvailable.value.body }}
        </p>
        <Button
          size="sm"
          class="w-fit"
          :disabled="updater.downloading.value"
          @click="handleDownloadAndRestart"
        >
          {{ updater.downloading.value ? 'Downloading...' : 'Download and restart' }}
        </Button>
        <div v-if="updater.downloading.value" class="space-y-2">
          <Progress
            v-if="updater.progress.value && updater.progress.value.contentLength > 0"
            :model-value="downloadProgressPercent"
          />
          <p class="text-xs text-muted-foreground">{{ downloadProgressLabel }}</p>
        </div>
      </div>

      <p
        v-else-if="lastCheckedLabel"
        class="text-sm text-muted-foreground"
      >
        Last checked: {{ lastCheckedLabel }}
      </p>
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
            <span>{{ shortcut.keys }}</span>
            <span class="text-muted-foreground">{{ shortcut.action }}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </section>
</template>
