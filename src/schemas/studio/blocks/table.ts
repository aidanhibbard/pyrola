import { z } from 'zod'

const tableColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  align: z.enum(['left', 'right', 'center']).optional(),
})

const tableRowSchema = z.record(z.union([z.string(), z.number()]))

const tableBlockSchema = z
  .object({
    title: z.string().optional(),
    columns: z.array(tableColumnSchema).optional(),
    rows: z.array(tableRowSchema).optional(),
  })
  .passthrough()

export default tableBlockSchema
