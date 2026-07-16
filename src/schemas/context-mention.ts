import { z } from 'zod'

export const contextMentionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('file'), path: z.string(), content: z.string().optional() }),
  z.object({ type: z.literal('folder'), path: z.string(), listing: z.string().optional() }),
  z.object({ type: z.literal('rule'), name: z.string() }),
  z.object({ type: z.literal('skill'), name: z.string() }),
])
