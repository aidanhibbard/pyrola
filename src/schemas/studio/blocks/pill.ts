import { z } from 'zod'

const pillBlockSchema = z
  .object({
    label: z.string().optional(),
    tone: z.enum(['default', 'secondary', 'outline', 'destructive']).optional(),
  })
  .passthrough()

export default pillBlockSchema
