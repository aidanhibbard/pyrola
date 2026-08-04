<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Trash2 } from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'
import { Badge } from '@/components/shadcn/ui/badge'
import SettingsSectionScroll from '@/components/settings/SettingsSectionScroll.vue'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import { parsePermissionRecords } from '@/services/harness/permission-policy'
import type { PermissionCapabilityKey, PermissionRecord } from '@/types/harness/permission'

const config = usePyrolaConfig()

const clearing = ref(false)

const records = computed((): PermissionRecord[] =>
  parsePermissionRecords(config.personalSettings.value['agent.permissions']),
)

const labelFor = (capability: PermissionCapabilityKey): string => {
  if (capability === 'shell') return 'Shell'
  if (capability === 'shell.unsandboxed') return 'Shell (unsandboxed)'
  if (capability === 'git.commit') return 'Git: commit'
  if (capability === 'git.checkout') return 'Git: checkout'
  if (capability === 'git.branch_create') return 'Git: create branch'
  if (capability === 'browser.interact') return 'Browser: interact'
  if (capability === 'browser.cdp') return 'Browser: CDP'
  if (capability === 'browser.share') return 'Browser: share'
  if (capability.startsWith('browser.navigate:')) {
    return `Browser navigate: ${capability.slice('browser.navigate:'.length)}`
  }
  if (capability.startsWith('fs.write:')) return `Write: ${capability.slice('fs.write:'.length)}`
  if (capability.startsWith('fs.delete:')) return `Delete: ${capability.slice('fs.delete:'.length)}`
  if (capability.startsWith('mcp:')) return `MCP: ${capability.slice('mcp:'.length)}`
  return capability
}

const handleRemove = async (record: PermissionRecord): Promise<void> => {
  try {
    const existing = parsePermissionRecords(config.personalSettings.value['agent.permissions'])
    const updated = existing.filter((r) => r.capability !== record.capability)
    await config.updateSetting('personal', 'agent.permissions', updated)
    toast.success('Permission removed')
  } catch (error) {
    toast.error('Failed to remove permission', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleClearAll = async (): Promise<void> => {
  clearing.value = true
  try {
    await config.updateSetting('personal', 'agent.permissions', [])
    toast.success('All permissions cleared')
  } catch (error) {
    toast.error('Failed to clear permissions', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    clearing.value = false
  }
}
</script>

<template>
  <SettingsSectionScroll title="Permissions">
    <template #actions>
      <Button
        v-if="records.length > 0"
        variant="ghost"
        size="sm"
        class="h-8 text-destructive hover:text-destructive"
        :disabled="clearing"
        @click="handleClearAll"
      >
        Clear all
      </Button>
    </template>

    <div
      v-if="records.length === 0"
      class="rounded-lg border border-border/50 px-4 py-8 text-center"
    >
      <p class="text-sm text-muted-foreground">
        No saved permissions. Allow or deny prompts will appear as the agent requests access.
      </p>
    </div>

    <div v-else class="space-y-1">
      <div
        v-for="record in records"
        :key="record.capability"
        class="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-mono">{{ labelFor(record.capability) }}</p>
          <p class="text-xs text-muted-foreground capitalize">{{ record.scope }}</p>
        </div>
        <Badge
          :variant="record.verdict === 'allow' ? 'default' : 'destructive'"
          class="shrink-0 capitalize"
        >
          {{ record.verdict }}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="Remove"
          @click="handleRemove(record)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  </SettingsSectionScroll>
</template>
