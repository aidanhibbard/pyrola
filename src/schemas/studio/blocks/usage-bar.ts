import { z } from 'zod'

const usageSegmentSchema = z.object({
  label: z.string(),
  value: z.number(),
  color: z.string().optional(),
})

const usageBarBlockSchema = z
  .object({
    title: z.string().optional(),
    segments: z.array(usageSegmentSchema).optional(),
  })
  .passthrough()

export default usageBarBlockSchema
