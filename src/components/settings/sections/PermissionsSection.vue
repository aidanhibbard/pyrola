<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Trash2 } from '@lucide/vue'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/shadcn/ui/accordion'
import { Button } from '@/components/shadcn/ui/button'
import { Badge } from '@/components/shadcn/ui/badge'
import { Label } from '@/components/shadcn/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
import McpServerIcon from '@/components/mcp/ServerIcon.vue'
import SettingsSectionScroll from '@/components/settings/SettingsSectionScroll.vue'
import useMcpServers from '@/composables/use-mcp-servers'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import groupPersistedPermissionRecords from '@/services/harness/permission/group-persisted-records'
import labelPermissionCapability from '@/services/harness/permission/label-capability'
import { parsePermissionRecords } from '@/services/harness/permission/policy'
import usesPermissionSubgroupAccordion from '@/services/harness/permission/uses-subgroup-accordion'
import type { PermissionRecord } from '@/types/harness/permission'
import type { PermissionGroup } from '@/types/harness/permission-group'

const config = usePyrolaConfig()
const { refreshStates } = useMcpServers()

const clearing = ref(false)

const records = computed((): PermissionRecord[] =>
  parsePermissionRecords(config.personalSettings.value['agent.permissions']),
)

const groupedRecords = computed((): PermissionGroup[] =>
  groupPersistedPermissionRecords(records.value),
)

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

onMounted(() => {
  refreshStates().catch((error: unknown) => {
    toast.error('Failed to load MCP server icons', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  })
})
</script>

<template>
  <SettingsSectionScroll title="Permissions">
    <template #actions>
      <Tooltip v-if="records.length > 0">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground hover:text-destructive"
            aria-label="Clear all"
            :disabled="clearing"
            @click="handleClearAll"
          >
            <Trash2 class="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Clear all</TooltipContent>
      </Tooltip>
    </template>

    <div
      v-if="records.length === 0"
      class="py-8 text-center"
    >
      <p class="text-sm text-muted-foreground">
        No saved permissions. Allow or deny prompts will appear as the agent requests access.
      </p>
    </div>

    <div
      v-else
      class="space-y-6"
    >
      <div
        v-for="group in groupedRecords"
        :key="group.kind"
        class="space-y-2"
      >
        <Label>{{ group.label }}</Label>

        <Accordion
          v-if="usesPermissionSubgroupAccordion(group.kind)"
          type="multiple"
          class="w-full"
        >
          <AccordionItem
            v-for="subgroup in group.subgroups"
            :key="subgroup.key"
            :value="`${group.kind}:${subgroup.key}`"
          >
            <AccordionTrigger class="py-3 text-sm hover:no-underline">
              <span class="flex min-w-0 items-center gap-2">
                <McpServerIcon
                  v-if="group.kind === 'mcp'"
                  :server-id="subgroup.key"
                />
                <span class="truncate">{{ subgroup.label }}</span>
                <Badge
                  variant="secondary"
                  class="shrink-0 font-normal tabular-nums"
                >
                  {{ subgroup.records.length }}
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div class="divide-y divide-border">
                <div
                  v-for="record in subgroup.records"
                  :key="record.capability"
                  class="flex items-center gap-3 py-2"
                >
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-mono">
                      {{ labelPermissionCapability(record.capability) }}
                    </p>
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
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div
          v-else
          class="divide-y divide-border"
        >
          <template
            v-for="subgroup in group.subgroups"
            :key="subgroup.key"
          >
            <div
              v-for="record in subgroup.records"
              :key="record.capability"
              class="flex items-center gap-3 py-2"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-mono">
                  {{ labelPermissionCapability(record.capability) }}
                </p>
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
          </template>
        </div>
      </div>
    </div>
  </SettingsSectionScroll>
</template>
