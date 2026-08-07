import type { ChatArtifact } from '@/types/chat/chat-artifact'
import type { ContextBucket } from '@/types/harness/context-bucket'
import type { FileDiff } from '@/types/harness/file-diff'
import type { ApprovalKind, PermissionScope } from '@/types/harness/permission'
import type { SideTaskKind } from '@/types/harness/side-task-kind'
import type { ChatMeta } from '@/types/chat/chat-meta'

export type TodoItem = {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
}

export type HarnessEvent =
  | { type: 'text-delta'; delta: string; messageId?: string; stepId?: string }
  | { type: 'reasoning-delta'; delta: string; messageId?: string; stepId?: string }
  | { type: 'tool-start'; toolCallId: string; name: string; args: unknown }
  | {
      type: 'tool-pending-approval'
      toolCallId: string
      name: string
      kind: ApprovalKind
      title: string
      detail?: string
      unsandboxed?: boolean
      allowedScopes: PermissionScope[]
      diff: FileDiff[]
    }
  | {
      type: 'tool-result'
      toolCallId: string
      result: unknown
      isError?: boolean
      artifact?: ChatArtifact
      diffs?: FileDiff[]
    }
  | { type: 'step-start'; stepId: string }
  | { type: 'step-finish'; stepId: string }
  | { type: 'tool-rejected'; toolCallId: string; reason: string }
  | { type: 'todo-update'; todos: TodoItem[] }
  | { type: 'plan-write'; planPath: string }
  | {
      type: 'subagent-start'
      subagentId: string
      toolCallId: string
      name: string
      blocking: boolean
      prompt?: string
      model?: string
    }
  | {
      type: 'subagent-event'
      subagentId: string
      parentToolCallId: string
      event: HarnessEvent
    }
  | { type: 'subagent-result'; subagentId: string; summary: string; blocking: boolean }
  | {
      type: 'pending-subagent'
      toolCallId: string
      subagentId: string
      agentName: string
      prompt: string
    }
  | { type: 'side-task-start'; taskId: string; kind: SideTaskKind }
  | { type: 'side-task-complete'; taskId: string; kind: SideTaskKind; result: unknown }
  | { type: 'chat-meta-changed'; projectSlug: string; chatId: string; patch: Partial<ChatMeta> }
  | { type: 'context-budget'; modelId: string; used: number; promptUsed: number; limit: number; reservedOutput: number; safetyBuffer: number; free: number; buckets: ContextBucket[] }
  | {
      type: 'context-usage'
      modelId: string
      promptTokens: number
      inputTokens: number
      outputTokens: number
      cacheReadTokens: number
      cacheWriteTokens: number
    }
  | { type: 'terminal-output'; shellId: string; stream: 'stdout' | 'stderr'; data: string }
  | { type: 'shell-complete'; shellId: string; exitCode: number }
  | { type: 'chat-status-changed'; projectSlug: string; chatId: string; status: 'idle' | 'running' }
  | { type: 'turn-aborted'; reason: 'user-stop' | 'error'; partialSteps: number }
  | { type: 'question-request'; toolCallId: string; question: string; options?: string[] }
  | { type: 'compaction'; summary: string; focus: string | null }
