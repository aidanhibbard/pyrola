<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Circle, Loader2, LogIn, LogOut, Play, Plus, RefreshCw, Server, ShieldAlert, Square, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shadcn/ui/tooltip'
import { Input } from '@/components/shadcn/ui/input'
import { Label } from '@/components/shadcn/ui/label'
import { Badge } from '@/components/shadcn/ui/badge'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/shadcn/ui/empty'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/ui/dialog'
import SettingsSectionScroll from '@/components/settings/SettingsSectionScroll.vue'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import useMcpServers from '@/composables/use-mcp-servers'
import type { SettingsTab } from '@/composables/use-pyrola-config'
import type { McpServerConfig } from '@/types/pyrola/mcp-config'
import { isMcpHttpServer } from '@/types/pyrola/mcp-config'
import type { McpTrustScope } from '@/types/harness/permission'
import { isMcpServerEnabled } from '@/schemas/mcp-config'
import {
  isMcpTrusted,
  sessionTrusts,
  upsertMcpTrustRecord,
} from '@/services/mcp/mcp-trust'

const props = defineProps<{
  tab: SettingsTab
}>()

const config = usePyrolaConfig()
const {
  personalMcp,
  projectMcp,
  serverStates,
  loadingServers,
  authenticatingServers,
  startServer,
  refreshServer,
  refreshAllServers,
  authenticateServer,
  logoutServer,
  addServer,
  deleteServer,
  setServerEnabled,
  listScopedMcpServers,
  refreshStates,
} = useMcpServers()

type TrustPending = {
  serverId: string
  action: () => Promise<void>
}

const expanded = ref<Record<string, boolean>>({})
const refreshingAll = ref(false)
const addOpen = ref(false)
const serverId = ref('')
const command = ref('npx')
const args = ref('shadcn-vue@latest,mcp')
const trustPending = ref<TrustPending | null>(null)
const trustSaving = ref(false)

const scopedServers = computed(() =>
  listScopedMcpServers(personalMcp.value, projectMcp.value, props.tab),
)

const toggleExpanded = (id: string): void => {
  expanded.value[id] = !expanded.value[id]
}

const isAuthCapableServer = (serverConfig: McpServerConfig): boolean =>
  isMcpHttpServer(serverConfig)

const serverStatus = (id: string): string =>
  serverStates.value[id]?.status ?? 'stopped'

const isServerLoading = (id: string): boolean =>
  loadingServers.value[id] === true || authenticatingServers.value[id] === true

const isServerRunning = (id: string, serverConfig: McpServerConfig): boolean =>
  isMcpServerEnabled(serverConfig) && serverStatus(id) !== 'stopped'

const showAuthControl = (serverConfig: McpServerConfig, id: string): boolean => {
  const status = serverStatus(id)
  if (status === 'auth_required') {
    return true
  }
  if (isAuthCapableServer(serverConfig) && status === 'connected') {
    return true
  }
  return false
}

const requireTrust = async (id: string, action: () => Promise<void>): Promise<void> => {
  if (isMcpTrusted(config.effectiveSettings.value, id, sessionTrusts)) {
    await action()
    return
  }
  trustPending.value = { serverId: id, action }
}

const handleTrustChoice = async (scope: McpTrustScope): Promise<void> => {
  const pending = trustPending.value
  if (!pending) {
    return
  }
  trustPending.value = null
  trustSaving.value = true

  try {
    if (scope === 'never') {
      const existing = config.personalSettings.value['agent.mcp.trust'] ?? []
      await config.updateSetting(
        'personal',
        'agent.mcp.trust',
        upsertMcpTrustRecord(existing, pending.serverId, 'never'),
      )
      return
    }

    if (scope === 'session') {
      sessionTrusts.add(pending.serverId)
    } else if (scope === 'workspace') {
      const rootPath = config.activeRootPath.value
      if (rootPath) {
        const existing = config.projectSettings.value['agent.mcp.trust'] ?? []
        await config.updateSetting(
          'project',
          'agent.mcp.trust',
          upsertMcpTrustRecord(existing, pending.serverId, 'workspace'),
        )
      } else {
        const existing = config.personalSettings.value['agent.mcp.trust'] ?? []
        await config.updateSetting(
          'personal',
          'agent.mcp.trust',
          upsertMcpTrustRecord(existing, pending.serverId, 'always'),
        )
      }
    } else {
      const existing = config.personalSettings.value['agent.mcp.trust'] ?? []
      await config.updateSetting(
        'personal',
        'agent.mcp.trust',
        upsertMcpTrustRecord(existing, pending.serverId, 'always'),
      )
    }

    await pending.action()
  } catch (error) {
    toast.error('Failed to trust server', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    trustSaving.value = false
  }
}

const handleEnabledChange = async (
  id: string,
  enabled: boolean,
): Promise<void> => {
  if (isServerLoading(id)) {
    return
  }
  if (enabled) {
    await requireTrust(id, async () => {
      try {
        await setServerEnabled(id, true, config.activeRootPath.value)
      } catch (error) {
        toast.error('Failed to update MCP server', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
    return
  }
  try {
    await setServerEnabled(id, false, config.activeRootPath.value)
  } catch (error) {
    toast.error('Failed to update MCP server', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const handleRefreshServer = async (
  id: string,
  serverConfig: McpServerConfig,
): Promise<void> => {
  if (isServerLoading(id)) {
    return
  }
  const status = serverStatus(id)
  if (status === 'connected' || status === 'error' || status === 'refreshing') {
    await refreshServer(id, serverConfig)
    return
  }
  await requireTrust(id, () => startServer(id, serverConfig))
}

const handleAuthAction = async (
  id: string,
  serverConfig: McpServerConfig,
): Promise<void> => {
  if (serverStatus(id) === 'auth_required') {
    await requireTrust(id, async () => {
      try {
        await authenticateServer(id, serverConfig)
      } catch {
        // authenticateServer already toasts.
      }
    })
    return
  }
  await logoutServer(id)
}

const submitNewServer = async (): Promise<void> => {
  if (!serverId.value.trim()) {
    toast.error('Server ID is required')
    return
  }
  const serverConfig: McpServerConfig = {
    command: command.value,
    args: args.value.split(',').map((part) => part.trim()).filter(Boolean),
  }
  await addServer(props.tab, serverId.value.trim(), serverConfig, config.activeRootPath.value)
  addOpen.value = false
  toast.success('Server saved')
}

onMounted(async () => {
  try {
    await refreshStates()
  } catch (error) {
    toast.error('Failed to refresh MCP server status', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

const refreshAll = async (): Promise<void> => {
  if (refreshingAll.value) {
    return
  }
  refreshingAll.value = true
  try {
    await refreshAllServers(
      scopedServers.value.map((server) => ({ id: server.id, config: server.config })),
    )
  } finally {
    refreshingAll.value = false
  }
}
</script>

<template>
  <SettingsSectionScroll title="MCP">
    <template #actions>
      <div class="flex items-center gap-0.5">
        <Tooltip v-if="scopedServers.length > 0">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8"
              aria-label="Refresh all"
              :disabled="refreshingAll"
              @click="refreshAll"
            >
              <Loader2 v-if="refreshingAll" class="h-4 w-4 animate-spin" />
              <RefreshCw v-else class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh all</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8"
              aria-label="Add server"
              @click="addOpen = true"
            >
              <Plus class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add server</TooltipContent>
        </Tooltip>
      </div>
    </template>

    <Empty
      v-if="scopedServers.length === 0"
      class="border border-border/60 py-12"
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Server />
        </EmptyMedia>
        <EmptyTitle>No MCP servers configured</EmptyTitle>
        <EmptyDescription>
          Add a server to connect tools and external context to your agents.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>

    <div v-else class="space-y-2">
      <div
        v-for="server in scopedServers"
        :key="server.id"
        class="rounded-lg border border-border/50"
      >
        <div class="flex flex-wrap items-center gap-2 px-4 py-2">
          <button
            class="flex min-w-0 items-center gap-2"
            :disabled="isServerLoading(server.id)"
            @click="toggleExpanded(server.id)"
          >
            <ChevronDown v-if="expanded[server.id]" class="h-4 w-4 shrink-0" />
            <ChevronRight v-else class="h-4 w-4 shrink-0" />
            <span class="truncate font-medium">{{ server.id }}</span>
            <Loader2
              v-if="isServerLoading(server.id) || serverStatus(server.id) === 'starting' || serverStatus(server.id) === 'refreshing'"
              class="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
            />
            <CheckCircle2
              v-else-if="isMcpServerEnabled(server.config) && serverStatus(server.id) === 'connected'"
              class="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
            />
            <AlertCircle
              v-else-if="isMcpServerEnabled(server.config) && serverStatus(server.id) === 'error'"
              class="h-3.5 w-3.5 shrink-0 text-destructive"
            />
            <ShieldAlert
              v-else-if="isMcpServerEnabled(server.config) && serverStatus(server.id) === 'auth_required'"
              class="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
            />
            <Circle
              v-else
              class="h-3.5 w-3.5 shrink-0 text-muted-foreground/50"
            />
          </button>
          <Badge
            v-if="!isServerLoading(server.id) && serverStates[server.id]?.tools?.length"
            variant="outline"
          >
            {{ serverStates[server.id]?.tools?.length }} tools
          </Badge>
          <div class="ml-auto flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8"
                  aria-label="Refresh server"
                  :disabled="isServerLoading(server.id)"
                  @click="handleRefreshServer(server.id, server.config)"
                >
                  <RefreshCw class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh server</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8"
                  :class="isServerRunning(server.id, server.config)
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'"
                  :disabled="isServerLoading(server.id)"
                  :aria-label="`${isServerRunning(server.id, server.config) ? 'Stop' : 'Start'} ${server.id}`"
                  @click="handleEnabledChange(server.id, !isServerRunning(server.id, server.config))"
                >
                  <Square v-if="isServerRunning(server.id, server.config)" class="h-4 w-4" />
                  <Play v-else class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {{
                  isServerRunning(server.id, server.config)
                    ? `Stop ${server.id}`
                    : `Start ${server.id}`
                }}
              </TooltipContent>
            </Tooltip>
            <Tooltip v-if="showAuthControl(server.config, server.id)">
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8"
                  :aria-label="serverStatus(server.id) === 'auth_required' ? 'Log in' : 'Log out'"
                  @click="handleAuthAction(server.id, server.config)"
                >
                  <LogIn v-if="serverStatus(server.id) === 'auth_required'" class="h-4 w-4" />
                  <LogOut v-else class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {{ serverStatus(server.id) === 'auth_required' ? 'Log in' : 'Log out' }}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-destructive hover:text-destructive"
                  aria-label="Delete server"
                  @click="deleteServer(tab, server.id, config.activeRootPath.value)"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete server</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div
          v-if="expanded[server.id] && !isServerLoading(server.id)"
          class="border-t border-border/50 px-4 py-3"
        >
          <div
            v-for="tool in serverStates[server.id]?.tools ?? []"
            :key="tool.name"
            class="py-2 text-sm"
          >
            <p class="font-mono">{{ tool.name }}</p>
            <p class="text-muted-foreground">{{ tool.description }}</p>
          </div>
        </div>
      </div>
    </div>

    <Dialog :open="addOpen" @update:open="(open) => (addOpen = open)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add MCP server</DialogTitle>
        </DialogHeader>
        <div class="space-y-3">
          <div class="space-y-2">
            <Label>Server ID</Label>
            <Input v-model="serverId" placeholder="shadcn" />
          </div>
          <div class="space-y-2">
            <Label>Command</Label>
            <Input v-model="command" />
          </div>
          <div class="space-y-2">
            <Label>Args (comma-separated)</Label>
            <Input v-model="args" />
          </div>
        </div>
        <DialogFooter>
          <Button @click="submitNewServer">Save &amp; Start</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="trustPending !== null" @update:open="(open) => { if (!open) trustPending = null }">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Trust MCP server?</DialogTitle>
        </DialogHeader>
        <div class="space-y-3 text-sm text-muted-foreground">
          <p>
            <span class="font-mono font-medium text-foreground">{{ trustPending?.serverId }}</span>
            is an MCP server that can execute code on your machine. Choose how much you trust it.
          </p>
          <p class="text-xs">
            Untrusted servers cannot be started or called by agents.
          </p>
        </div>
        <DialogFooter class="flex-col gap-2 sm:flex-col">
          <Button
            class="w-full"
            :disabled="trustSaving"
            @click="handleTrustChoice('session')"
          >
            This session
          </Button>
          <Button
            v-if="config.activeRootPath.value"
            variant="outline"
            class="w-full"
            :disabled="trustSaving"
            @click="handleTrustChoice('workspace')"
          >
            This workspace
          </Button>
          <Button
            variant="outline"
            class="w-full"
            :disabled="trustSaving"
            @click="handleTrustChoice('always')"
          >
            Always
          </Button>
          <Button
            variant="ghost"
            class="w-full text-destructive hover:text-destructive"
            :disabled="trustSaving"
            @click="handleTrustChoice('never')"
          >
            Never
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </SettingsSectionScroll>
</template>
