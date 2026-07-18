import { z } from 'zod'

const chartRowSchema = z.record(z.union([z.string(), z.number()]))

const chartBlockSchema = z
  .object({
    type: z.union([z.enum(['bar', 'line', 'area']), z.string()]).optional(),
    title: z.string().optional(),
    xLabel: z.string().optional(),
    yLabel: z.string().optional(),
    source: z.string().optional(),
    data: z.array(chartRowSchema).optional(),
    xKey: z.string().optional(),
    yKey: z.string().optional(),
  })
  .passthrough()

export default chartBlockSchema
