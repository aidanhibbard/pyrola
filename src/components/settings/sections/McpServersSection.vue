<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronDown, ChevronRight, Loader2, LogIn, LogOut, Play, Plus, RefreshCw, Server, Square, Trash2 } from '@lucide/vue'
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

const props = defineProps<{
  tab: SettingsTab
}>()

const config = usePyrolaConfig()
const {
  personalMcp,
  projectMcp,
  serverStates,
  loadingServers,
  startServer,
  stopServer,
  refreshServer,
  refreshAllServers,
  logoutServer,
  addServer,
  deleteServer,
  listScopedMcpServers,
  refreshStates,
} = useMcpServers()

const expanded = ref<Record<string, boolean>>({})
const refreshingAll = ref(false)
const addOpen = ref(false)
const serverId = ref('')
const command = ref('npx')
const args = ref('shadcn-vue@latest,mcp')

const scopedServers = computed(() =>
  listScopedMcpServers(personalMcp.value, projectMcp.value, props.tab),
)

const toggleExpanded = (id: string): void => {
  expanded.value[id] = !expanded.value[id]
}

const isAuthCapableServer = (serverConfig: McpServerConfig): boolean =>
  !('command' in serverConfig)

const serverStatus = (serverId: string): string =>
  serverStates.value[serverId]?.status ?? 'stopped'

const isServerLoading = (serverId: string): boolean =>
  loadingServers.value[serverId] === true

const isServerRunning = (serverId: string): boolean => {
  const status = serverStatus(serverId)
  return (
    status === 'connected' ||
    status === 'starting' ||
    status === 'refreshing' ||
    status === 'error'
  )
}

const showAuthControl = (serverConfig: McpServerConfig, serverId: string): boolean => {
  if (!isAuthCapableServer(serverConfig)) {
    return false
  }
  const status = serverStatus(serverId)
  return status === 'auth_required' || status === 'connected'
}

const toggleServerPower = async (
  serverId: string,
  serverConfig: McpServerConfig,
): Promise<void> => {
  if (isServerLoading(serverId)) {
    return
  }
  if (isServerRunning(serverId)) {
    await stopServer(serverId)
    return
  }
  await startServer(serverId, serverConfig)
}

const handleRefreshServer = async (
  serverId: string,
  serverConfig: McpServerConfig,
): Promise<void> => {
  if (isServerLoading(serverId)) {
    return
  }
  const status = serverStatus(serverId)
  if (status === 'connected' || status === 'error' || status === 'refreshing') {
    await refreshServer(serverId)
    return
  }
  await startServer(serverId, serverConfig)
}

const handleAuthAction = async (
  serverId: string,
  serverConfig: McpServerConfig,
): Promise<void> => {
  if (serverStatus(serverId) === 'auth_required') {
    await startServer(serverId, serverConfig)
    return
  }
  await logoutServer(serverId)
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
            class="flex items-center gap-2"
            :disabled="isServerLoading(server.id)"
            @click="toggleExpanded(server.id)"
          >
            <Loader2
              v-if="isServerLoading(server.id)"
              class="h-4 w-4 animate-spin text-muted-foreground"
            />
            <ChevronDown v-else-if="expanded[server.id]" class="h-4 w-4" />
            <ChevronRight v-else class="h-4 w-4" />
            <span class="font-medium">{{ server.id }}</span>
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
                  :aria-label="isServerRunning(server.id) ? 'Stop server' : 'Start server'"
                  :disabled="isServerLoading(server.id)"
                  @click="toggleServerPower(server.id, server.config)"
                >
                  <Square v-if="isServerRunning(server.id)" class="h-4 w-4" />
                  <Play v-else class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {{ isServerRunning(server.id) ? 'Stop server' : 'Start server' }}
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
  </SettingsSectionScroll>
</template>
