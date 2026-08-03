<script setup lang="ts">
import { AlertTriangleIcon } from '@lucide/vue'
import type { ApprovalResolution } from '@/services/harness/approval-gate'
import type { PendingApprovalView } from '@/services/harness/gate-tool-permission'
import type { PermissionScope } from '@/types/harness/permission'
import ChatInlineFileDiff from '@/components/chat/InlineFileDiff.vue'
import { Alert, AlertDescription } from '@/components/shadcn/ui/alert'
import { Badge } from '@/components/shadcn/ui/badge'
import { Button } from '@/components/shadcn/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/ui/collapsible'
import { Marker, MarkerContent } from '@/components/shadcn/ui/marker'
import { Separator } from '@/components/shadcn/ui/separator'

defineProps<{
  approval: PendingApprovalView
}>()

const emit = defineEmits<{
  resolve: [resolution: ApprovalResolution]
}>()

type ScopeConfig = {
  scope: PermissionScope
  label: string
  variant: 'default' | 'secondary' | 'outline' | 'destructive'
  approved: boolean
}

const SCOPE_CONFIG: Record<PermissionScope, ScopeConfig> = {
  once: { scope: 'once', label: 'Allow once', variant: 'default', approved: true },
  session: { scope: 'session', label: 'Allow session', variant: 'secondary', approved: true },
  workspace: { scope: 'workspace', label: 'Allow workspace', variant: 'secondary', approved: true },
  always: { scope: 'always', label: 'Always allow', variant: 'secondary', approved: true },
  never: { scope: 'never', label: 'Deny permanently', variant: 'destructive', approved: false },
}

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
          {{ approval.title }}
        </MarkerContent>
      </Marker>
    </CollapsibleTrigger>
    <CollapsibleContent class="space-y-3 px-2 py-2">
      <p
        v-if="approval.detail"
        class="text-sm text-muted-foreground"
      >
        {{ approval.detail }}
      </p>

      <Alert
        v-if="approval.unsandboxed"
        variant="destructive"
        class="py-2"
      >
        <AlertTriangleIcon class="size-4" />
        <AlertDescription>
          This command runs outside the sandbox and has full system access.
        </AlertDescription>
      </Alert>

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

      <Separator />

      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-for="scope in approval.allowedScopes"
          :key="scope"
          :variant="SCOPE_CONFIG[scope].variant"
          size="sm"
          @click="handleScope(scope)"
        >
          {{ SCOPE_CONFIG[scope].label }}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="ml-auto text-muted-foreground hover:text-foreground"
          @click="handleDeny"
        >
          Deny
        </Button>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
