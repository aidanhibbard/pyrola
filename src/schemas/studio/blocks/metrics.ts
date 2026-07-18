import { z } from 'zod'

const metricItemSchema = z.object({
  label: z.string(),
  value: z.string(),
  delta: z.string().optional(),
  tone: z.enum(['positive', 'negative', 'neutral']).optional(),
})

const metricsBlockSchema = z
  .object({
    items: z.array(metricItemSchema).optional(),
  })
  .passthrough()

export default metricsBlockSchema
