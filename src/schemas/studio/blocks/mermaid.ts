import { z } from 'zod'

const mermaidBlockSchema = z
  .object({
    code: z.string().optional(),
  })
  .passthrough()

export default mermaidBlockSchema
