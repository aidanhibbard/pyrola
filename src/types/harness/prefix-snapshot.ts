import type { SystemPromptParts } from '@/services/context/system-prompt-parts'

export type PrefixSnapshot = {
  systemString: string
  toolSchemasJson: string
  mcpCatalogSnapshot: string
  rulesBodies: string
  hash: string
  frozenAt: string
  /** Bucket-ready parts at freeze time. Older snapshots may omit this. */
  parts?: SystemPromptParts
}
