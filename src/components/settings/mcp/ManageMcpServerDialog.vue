<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Plus, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/shadcn/ui/button'
import { Input } from '@/components/shadcn/ui/input'
import { Label } from '@/components/shadcn/ui/label'
import { Badge } from '@/components/shadcn/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/shadcn/ui/dialog'
import SettingsInputPasswordInput from '@/components/settings/input/PasswordInput.vue'
import type {
  McpConfig,
  McpHttpServer,
  McpInputDefinition,
  McpServerConfig,
  McpStdioServer,
} from '@/types/pyrola/mcp-config'
import { isMcpHttpServer, isMcpStdioServer } from '@/types/pyrola/mcp-config'
import { mcpInputKey } from '@/services/mcp/mcp-keychain-keys'
import { getSecret } from '@/services/pyrola/pyrola-tauri'

type SecretRow = {
  key: string
  /** New secret value. Empty means keep existing keychain value when configured. */
  value: string
  configured: boolean
}

type Transport = 'stdio' | 'http' | 'sse'

const INPUT_TEMPLATE = /^\$\{input:([^}]+)\}$/

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  serverId?: string | null
  initialConfig?: McpServerConfig | null
  mcpConfig: McpConfig
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  save: [
    payload: {
      serverId: string
      previousId?: string
      config: McpServerConfig
      inputs: McpInputDefinition[]
      secretValues: Record<string, string>
    },
  ]
}>()

const draftId = ref('')
const transport = ref<Transport>('stdio')
const command = ref('npx')
const argsText = ref('')
const url = ref('')
const envRows = ref<SecretRow[]>([])
const headerRows = ref<SecretRow[]>([])
const oauthClientId = ref('')
const asAllowlistText = ref('')

const templateRef = (key: string): string => `\${input:${key}}`

const inputIdFromValue = (value: string): string | null => {
  const match = value.trim().match(INPUT_TEMPLATE)
  return match?.[1] ?? null
}

const probeConfigured = async (
  serverId: string,
  inputId: string,
): Promise<boolean> => {
  const stored = await getSecret(mcpInputKey(serverId, inputId))
  return stored !== null && stored.length > 0
}

const recordToSecretRows = async (
  record: Record<string, string> | undefined,
  serverId: string | null,
): Promise<SecretRow[]> => {
  const entries = Object.entries(record ?? {})
  const rows: SecretRow[] = []
  for (const [key, rawValue] of entries) {
    const inputId = inputIdFromValue(rawValue) ?? key
    const configured =
      serverId !== null && serverId.length > 0
        ? await probeConfigured(serverId, inputId)
        : false
    rows.push({
      key,
      value: '',
      configured,
    })
  }
  return rows
}

const resetFromProps = async (): Promise<void> => {
  draftId.value = props.serverId ?? ''
  const config = props.initialConfig
  if (!config) {
    transport.value = 'stdio'
    command.value = 'npx'
    argsText.value = ''
    url.value = ''
    envRows.value = []
    headerRows.value = []
    oauthClientId.value = ''
    asAllowlistText.value = ''
    return
  }

  const serverId = props.serverId ?? null

  if (isMcpHttpServer(config)) {
    transport.value = config.type
    url.value = config.url
    headerRows.value = await recordToSecretRows(config.headers, serverId)
    envRows.value = []
    command.value = 'npx'
    argsText.value = ''
    oauthClientId.value = config.oauth?.clientId ?? ''
    asAllowlistText.value = (config.oauth?.allowedAuthorizationServers ?? []).join('\n')
    return
  }

  if (isMcpStdioServer(config)) {
    transport.value = 'stdio'
    command.value = config.command
    argsText.value = (config.args ?? []).join(', ')
    envRows.value = await recordToSecretRows(config.env, serverId)
    headerRows.value = []
    oauthClientId.value = ''
    asAllowlistText.value = ''
  }
}

watch(
  () => [props.open, props.serverId, props.initialConfig] as const,
  ([open]) => {
    if (!open) {
      return
    }
    resetFromProps().catch((error: unknown) => {
      toast.error('Failed to load server', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    })
  },
)

onMounted(() => {
  if (props.open) {
    resetFromProps().catch((error: unknown) => {
      toast.error('Failed to load server', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    })
  }
})

const addEnvRow = (): void => {
  envRows.value = [...envRows.value, { key: '', value: '', configured: false }]
}

const addHeaderRow = (): void => {
  headerRows.value = [
    ...headerRows.value,
    { key: '', value: '', configured: false },
  ]
}

const buildSecretRecord = (
  rows: SecretRow[],
): {
  record?: Record<string, string>
  inputs: McpInputDefinition[]
  secretValues: Record<string, string>
} => {
  const record: Record<string, string> = {}
  const inputs: McpInputDefinition[] = []
  const secretValues: Record<string, string> = {}
  const seenInputs = new Set<string>()

  for (const row of rows) {
    const key = row.key.trim()
    if (!key) {
      continue
    }
    const inputId = key
    record[key] = templateRef(inputId)
    if (!seenInputs.has(inputId)) {
      seenInputs.add(inputId)
      inputs.push({
        id: inputId,
        type: 'promptString',
        description: inputId,
        password: true,
      })
    }
    const nextValue = row.value.trim()
    if (nextValue.length > 0) {
      secretValues[inputId] = nextValue
    } else if (!row.configured) {
      // New unset secret: still wire the template; value can be filled via Edit secrets.
    }
  }

  return {
    record: Object.keys(record).length > 0 ? record : undefined,
    inputs,
    secretValues,
  }
}

const handleSave = (): void => {
  const serverId = draftId.value.trim()
  if (!serverId) {
    toast.error('Server ID is required')
    return
  }

  let config: McpServerConfig
  let inputs: McpInputDefinition[] = []
  let secretValues: Record<string, string> = {}

  if (transport.value === 'stdio') {
    const built = buildSecretRecord(envRows.value)
    inputs = built.inputs
    secretValues = built.secretValues
    const stdio: McpStdioServer = {
      command: command.value.trim(),
      args: argsText.value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
      env: built.record,
    }
    if (!stdio.command) {
      toast.error('Command is required')
      return
    }
    for (const row of envRows.value) {
      const key = row.key.trim()
      if (!key) {
        continue
      }
      if (!row.configured && row.value.trim().length === 0) {
        toast.error('Secret value required', {
          description: `Enter a value for ${key}, or remove that row.`,
        })
        return
      }
    }
    config = stdio
  } else {
    const built = buildSecretRecord(headerRows.value)
    inputs = built.inputs
    secretValues = built.secretValues
    const http: McpHttpServer = {
      type: transport.value,
      url: url.value.trim(),
      headers: built.record,
    }
    if (!http.url) {
      toast.error('URL is required')
      return
    }
    for (const row of headerRows.value) {
      const key = row.key.trim()
      if (!key) {
        continue
      }
      if (!row.configured && row.value.trim().length === 0) {
        toast.error('Secret value required', {
          description: `Enter a value for ${key}, or remove that row.`,
        })
        return
      }
    }
    const allowlist = asAllowlistText.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (oauthClientId.value.trim() || allowlist.length > 0) {
      http.oauth = {
        ...(oauthClientId.value.trim()
          ? { clientId: oauthClientId.value.trim() }
          : {}),
        ...(allowlist.length > 0 ? { allowedAuthorizationServers: allowlist } : {}),
      }
    }
    config = http
  }

  emit('save', {
    serverId,
    previousId: props.mode === 'edit' ? (props.serverId ?? undefined) : undefined,
    config,
    inputs,
    secretValues,
  })
  emit('update:open', false)
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="(value) => emit('update:open', value)"
  >
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <div class="space-y-4">
        <p class="text-sm text-muted-foreground">
          Enter each API key once below. Values go to your OS keychain; mcp.json only stores the env or header name.
        </p>

        <div class="space-y-2">
          <Label>Server ID</Label>
          <Input
            v-model="draftId"
            :disabled="mode === 'edit'"
            placeholder="brave-search"
          />
        </div>

        <div class="space-y-2">
          <Label>Transport</Label>
          <select
            v-model="transport"
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          >
            <option value="stdio">stdio</option>
            <option value="http">http</option>
            <option value="sse">sse</option>
          </select>
        </div>

        <template v-if="transport === 'stdio'">
          <div class="space-y-2">
            <Label>Command</Label>
            <Input
              v-model="command"
              placeholder="npx"
            />
            <p class="text-xs text-muted-foreground">
              PATH basename only (for example npx or uvx). Review before trusting.
            </p>
          </div>
          <div class="space-y-2">
            <Label>Args (comma-separated)</Label>
            <Input
              v-model="argsText"
              placeholder="-y, @brave/brave-search-mcp-server, --transport, stdio"
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div>
                <Label>Secrets (env)</Label>
                <p class="text-xs text-muted-foreground">
                  Name the env var and enter its value once. Pyrola wires it for the process.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                @click="addEnvRow"
              >
                <Plus class="h-4 w-4" />
                Add
              </Button>
            </div>
            <div
              v-for="(row, index) in envRows"
              :key="`env-${index}`"
              class="space-y-2 rounded-md border border-border/50 p-3"
            >
              <div class="flex items-center gap-2">
                <Input
                  v-model="row.key"
                  class="flex-1"
                  placeholder="BRAVE_API_KEY"
                />
                <Badge
                  v-if="row.configured && !row.value.trim()"
                  variant="outline"
                >
                  Saved
                </Badge>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  @click="envRows = envRows.filter((_, i) => i !== index)"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
              <SettingsInputPasswordInput
                v-model="row.value"
                :placeholder="
                  row.configured
                    ? 'Leave blank to keep saved value'
                    : 'Paste secret'
                "
              />
            </div>
          </div>
        </template>

        <template v-else>
          <div class="space-y-2">
            <Label>URL</Label>
            <Input
              v-model="url"
              placeholder="https://example.com/mcp"
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div>
                <Label>Secrets (headers)</Label>
                <p class="text-xs text-muted-foreground">
                  Header name and value. Enter the secret once; it is stored in the keychain.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                @click="addHeaderRow"
              >
                <Plus class="h-4 w-4" />
                Add
              </Button>
            </div>
            <div
              v-for="(row, index) in headerRows"
              :key="`header-${index}`"
              class="space-y-2 rounded-md border border-border/50 p-3"
            >
              <div class="flex items-center gap-2">
                <Input
                  v-model="row.key"
                  class="flex-1"
                  placeholder="Authorization"
                />
                <Badge
                  v-if="row.configured && !row.value.trim()"
                  variant="outline"
                >
                  Saved
                </Badge>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  @click="headerRows = headerRows.filter((_, i) => i !== index)"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
              <SettingsInputPasswordInput
                v-model="row.value"
                :placeholder="
                  row.configured
                    ? 'Leave blank to keep saved value'
                    : 'Paste secret'
                "
              />
            </div>
          </div>

          <div class="space-y-2">
            <Label>OAuth client ID (optional)</Label>
            <Input
              v-model="oauthClientId"
              placeholder="Leave blank for dynamic registration"
            />
          </div>
          <div class="space-y-2">
            <Label>Allowed authorization servers (optional)</Label>
            <p class="text-xs text-muted-foreground">
              One origin URL per line. If empty, you confirm the server on first login.
            </p>
            <textarea
              v-model="asAllowlistText"
              class="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              placeholder="https://auth.example.com"
            />
          </div>
        </template>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          @click="emit('update:open', false)"
        >
          Cancel
        </Button>
        <Button
          type="button"
          @click="handleSave"
        >
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
