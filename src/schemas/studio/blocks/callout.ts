import { z } from 'zod'

const calloutBlockSchema = z
  .object({
    tone: z.enum(['default', 'info', 'warning', 'destructive']).optional(),
    title: z.string().optional(),
  })
  .passthrough()

export default calloutBlockSchema
