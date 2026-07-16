import { z } from 'zod'

export const chatMessageLineSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(z.record(z.unknown())),
  createdAt: z.string(),
  harnessEvent: z.record(z.unknown()).optional(),
})
