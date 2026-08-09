import { z } from 'zod'

export const mentionHighlightSchema = z.object({
  kind: z.enum(['skill', 'mention']),
  token: z.string().min(1),
})
