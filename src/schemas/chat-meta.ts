import { z } from 'zod'

const chatModeSchema = z.enum(['ask', 'plan', 'studio', 'agent', 'orchestrator'])

export const prefixSnapshotSchema = z.object({
  systemString: z.string(),
  toolSchemasJson: z.string(),
  mcpCatalogSnapshot: z.string(),
  rulesBodies: z.string(),
  hash: z.string(),
  frozenAt: z.string(),
})

export const activeContextSchema = z.object({
  checkpointLineId: z.string().optional(),
  includeFromCreatedAt: z.string().optional(),
  summary: z.string().optional(),
})

export const chatMetaSchema = z.object({
  id: z.string(),
  title: z.string(),
  projectSlug: z.string(),
  projectRoot: z.string(),
  mode: chatModeSchema,
  model: z.string(),
  status: z.enum(['idle', 'running']),
  createdAt: z.string(),
  updatedAt: z.string(),
  forkedFrom: z.string().nullable(),
  pinned: z.boolean(),
  pinnedAt: z.string().nullable(),
  prefixSnapshot: prefixSnapshotSchema.optional(),
  activeContext: activeContextSchema.optional(),
})
