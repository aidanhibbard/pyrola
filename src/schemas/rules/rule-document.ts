import { z } from 'zod'

export const createRuleInputSchema = z.object({
  name: z.string().min(1),
  body: z.string(),
})

export type CreateRuleInput = z.infer<typeof createRuleInputSchema>
