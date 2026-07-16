import type { ContextBucketId } from '@/types/harness/context-bucket'

export type ContextBucketMeta = {
  label: string
  colorClass: string
}

export const CONTEXT_BUCKET_ORDER: ContextBucketId[] = [
  'system',
  'tools',
  'rules',
  'skills',
  'mentions',
  'subagentDefinitions',
  'messages',
]

export const CONTEXT_BUCKET_META: Record<ContextBucketId, ContextBucketMeta> = {
  system: { label: 'System prompt', colorClass: 'bg-muted-foreground/70' },
  tools: { label: 'Tool definitions', colorClass: 'bg-purple-500' },
  rules: { label: 'Rules', colorClass: 'bg-emerald-500' },
  skills: { label: 'Skills', colorClass: 'bg-orange-500' },
  mentions: { label: 'Context mentions', colorClass: 'bg-violet-500' },
  subagentDefinitions: { label: 'Subagent definitions', colorClass: 'bg-blue-500' },
  messages: { label: 'Conversation', colorClass: 'bg-rose-500' },
}
