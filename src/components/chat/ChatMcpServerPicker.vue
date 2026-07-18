<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDownIcon, ServerIcon } from '@lucide/vue'
import { Button } from '@/components/shadcn/ui/button'
import { Input } from '@/components/shadcn/ui/input'
import { Badge } from '@/components/shadcn/ui/badge'
import { Switch } from '@/components/shadcn/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu'
import useMcpServers from '@/composables/use-mcp-servers'
import type { McpServerConfig } from '@/types/pyrola/mcp-config'

const {
  personalMcp,
  projectMcp,
  serverStates,
  loadingServers,
  startServer,
  stopServer,
  refreshStates,
  listEffectiveMcpServers,
} = useMcpServers()

const menuOpen = ref(false)
const searchQuery = ref('')

const effectiveServers = computed(() =>
  listEffectiveMcpServers(personalMcp.value, projectMcp.value),
)

const filteredServers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return effectiveServers.value
  }
  return effectiveServers.value.filter((server) =>
    server.id.toLowerCase().includes(query),
  )
})

const runningCount = computed(() =>
  effectiveServers.value.filter((server) => statusLabel(server.id) === 'running').length,
)

type McpStatusLabel = 'running' | 'stopped' | 'error'

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

const statusLabel = (serverId: string): McpStatusLabel => {
  const status = serverStatus(serverId)
  if (status === 'error') {
    return 'error'
  }
  if (status === 'connected' || status === 'starting' || status === 'refreshing') {
    return 'running'
  }
  return 'stopped'
}

const statusBadgeVariant = (label: McpStatusLabel): 'default' | 'secondary' | 'destructive' => {
  if (label === 'running') {
    return 'default'
  }
  if (label === 'error') {
    return 'destructive'
  }
  return 'secondary'
}

const handleOpenChange = async (open: boolean): Promise<void> => {
  menuOpen.value = open
  if (open) {
    searchQuery.value = ''
    await refreshStates()
  }
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

const handleToggleChange = async (
  serverId: string,
  serverConfig: McpServerConfig,
  checked: boolean,
): Promise<void> => {
  const running = isServerRunning(serverId)
  if (checked === running) {
    return
  }
  await toggleServerPower(serverId, serverConfig)
}
</script>

<template>
  <DropdownMenu :open="menuOpen" @update:open="handleOpenChange">
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
        :title="`${runningCount} of ${effectiveServers.length} MCP servers running`"
      >
        <ServerIcon class="size-3.5 shrink-0" />
        <span class="max-w-32 truncate">
          MCP
          <template v-if="effectiveServers.length > 0">
            ({{ runningCount }}/{{ effectiveServers.length }})
          </template>
        </span>
        <ChevronDownIcon class="size-3 shrink-0 opacity-60" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-72 p-0">
      <div class="border-b border-border/50 p-2" @pointerdown.stop>
        <Input
          v-model="searchQuery"
          placeholder="Search MCP servers…"
          class="h-8"
          @keydown.stop
        />
      </div>
      <div class="max-h-60 overflow-y-auto p-2">
        <p
          v-if="filteredServers.length === 0"
          class="px-2 py-4 text-center text-sm text-muted-foreground"
        >
          {{
            searchQuery.trim()
              ? 'No servers match your search.'
              : 'No MCP servers configured.'
          }}
        </p>
        <div
          v-for="server in filteredServers"
          :key="server.id"
          class="flex items-center gap-2 rounded-md px-2 py-1.5"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ server.id }}</p>
            <Badge
              :variant="statusBadgeVariant(statusLabel(server.id))"
              class="mt-0.5 capitalize"
            >
              {{ statusLabel(server.id) }}
            </Badge>
          </div>
          <div @pointerdown.stop @click.stop>
            <Switch
              :checked="isServerRunning(server.id)"
              :disabled="isServerLoading(server.id)"
              :aria-label="`${isServerRunning(server.id) ? 'Disable' : 'Enable'} ${server.id}`"
              @update:checked="(checked: boolean) => handleToggleChange(server.id, server.config, checked)"
            />
          </div>
        </div>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
