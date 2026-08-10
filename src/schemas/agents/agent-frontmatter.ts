import { z } from 'zod'
import { reasoningLevelSchema } from '@/schemas/models/reasoning-level'

export const agentFrontmatterSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  reasoning: reasoningLevelSchema.optional(),
  tools: z.array(z.string()).optional(),
})

export type AgentFrontmatter = z.infer<typeof agentFrontmatterSchema>

export default agentFrontmatterSchema
