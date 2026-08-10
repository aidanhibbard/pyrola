import type { PendingApprovalView } from '@/services/harness/permission/gate'
import type { HarnessEvent } from '@/types/harness/harness-event'
import type { PermissionCapabilityKey, PermissionLevel } from '@/types/harness/permission'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'

type HarnessToolContext = {
  projectRoot: string
  projectSlug: string
  chatId: string
  /** User message that started this agent turn; required for file checkpoints. */
  userMessageId?: string
  /** AgentTurn.id for the parent turn (billable usage attribution). */
  turnId?: string
  settings: PyrolaSettings
  permissionLevel: PermissionLevel
  sessionAllows: Set<string>
  sessionDenies: Set<string>
  sandboxEnabled: boolean
  supportsVision: boolean
  onPendingApproval: (entry: PendingApprovalView) => void
  persistPermission?: (
    capability: PermissionCapabilityKey,
    verdict: 'allow' | 'deny',
    scope: 'workspace' | 'always',
  ) => Promise<void>
  onHarnessEvent?: (event: HarnessEvent) => void
  signal?: AbortSignal
  /** Set when tools run inside a spawn_subagent nested agent. */
  subagentId?: string
  subagentLabel?: string
}

export type { HarnessToolContext }
