import { z } from 'zod'

const chatModeSchema = z.enum(['ask', 'plan', 'studio', 'agent'])

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
})
