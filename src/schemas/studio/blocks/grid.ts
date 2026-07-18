import { z } from 'zod'

const gridBlockSchema = z
  .object({
    cols: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough()

export default gridBlockSchema
