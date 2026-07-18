import { z } from 'zod'

const pageHeaderBlockSchema = z
  .object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    meta: z.string().optional(),
  })
  .passthrough()

export default pageHeaderBlockSchema
