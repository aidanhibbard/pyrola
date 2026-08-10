import { z } from 'zod'
import { reasoningLevelSchema } from '@/schemas/models/reasoning-level'

export const createAgentInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  body: z.string(),
  model: z.string().min(1).optional(),
  reasoning: reasoningLevelSchema.optional(),
  tools: z.array(z.string()).optional(),
})

export type CreateAgentInput = z.infer<typeof createAgentInputSchema>

export default createAgentInputSchema
