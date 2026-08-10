<script setup lang="ts">
import { computed } from 'vue'
import type { ApprovalResolution } from '@/services/harness/permission/approval-gate'
import type { PendingApprovalView } from '@/services/harness/permission/gate'
import type { PermissionScope } from '@/types/harness/permission'
import ChatInlineFileDiff from '@/components/chat/InlineFileDiff.vue'
import McpServerIcon from '@/components/mcp/ServerIcon.vue'
import { Badge } from '@/components/shadcn/ui/badge'
import { Button } from '@/components/shadcn/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/ui/collapsible'
import { Marker, MarkerContent } from '@/components/shadcn/ui/marker'

const props = defineProps<{
  approval: PendingApprovalView
}>()

const emit = defineEmits<{
  resolve: [resolution: ApprovalResolution]
}>()

type ScopeConfig = {
  scope: PermissionScope
  label: string
  approved: boolean
}

const SCOPE_CONFIG: Record<PermissionScope, ScopeConfig> = {
  once: { scope: 'once', label: 'Allow once', approved: true },
  session: { scope: 'session', label: 'Allow session', approved: true },
  workspace: { scope: 'workspace', label: 'Allow workspace', approved: true },
  always: { scope: 'always', label: 'Always allow', approved: true },
  never: { scope: 'never', label: 'Never', approved: false },
}

const optionScopes = computed(() =>
  props.approval.allowedScopes.filter((scope) => scope !== 'never'),
)

const showNever = computed(() =>
  props.approval.allowedScopes.includes('never'),
)

const handleScope = (scope: PermissionScope): void => {
  const cfg = SCOPE_CONFIG[scope]
  if (cfg.approved) {
    emit('resolve', {
      approved: true,
      scope: scope as Exclude<PermissionScope, 'never'>,
    })
  } else {
    emit('resolve', { approved: false, scope: 'never' })
  }
}

const handleDeny = (): void => {
  emit('resolve', { approved: false, scope: 'once' })
}
</script>

<template>
  <Collapsible default-open class="w-full">
    <CollapsibleTrigger as-child>
      <Marker variant="border" class="w-full cursor-pointer">
        <MarkerContent class="gap-2">
          <Badge variant="outline" class="shrink-0 text-xs font-normal capitalize">
            {{ approval.kind }}
          </Badge>
          <McpServerIcon
            v-if="approval.kind === 'mcp' && approval.serverId"
            :server-id="approval.serverId"
          />
          {{ approval.title }}
        </MarkerContent>
      </Marker>
    </CollapsibleTrigger>
    <CollapsibleContent class="space-y-2 px-2 py-2">
      <p
        v-if="approval.detail"
        class="text-sm text-muted-foreground"
      >
        {{ approval.detail }}
      </p>

      <div
        v-if="approval.kind === 'fs' && approval.diff && approval.diff.length > 0"
        class="space-y-1"
      >
        <ChatInlineFileDiff
          v-for="diff in approval.diff"
          :key="diff.path"
          :diff="diff"
        />
      </div>

      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
        <span
          v-if="approval.unsandboxed"
          class="text-destructive"
        >
          This command runs outside the sandbox and has full system access.
        </span>
        <Button
          v-for="scope in optionScopes"
          :key="scope"
          type="button"
          variant="link"
          size="xs"
          class="h-auto px-0 py-0 text-xs font-normal"
          @click="handleScope(scope)"
        >
          {{ SCOPE_CONFIG[scope].label }}
        </Button>
        <Button
          type="button"
          variant="link"
          size="xs"
          class="h-auto px-0 py-0 text-xs font-normal text-muted-foreground"
          @click="handleDeny"
        >
          Deny
        </Button>
        <Button
          v-if="showNever"
          type="button"
          variant="link"
          size="xs"
          class="ml-auto h-auto px-0 py-0 text-xs font-normal text-destructive"
          @click="handleScope('never')"
        >
          {{ SCOPE_CONFIG.never.label }}
        </Button>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
