import { z } from 'zod'
import { planTodoItemSchema } from '@/schemas/plan-document'

export const createPlanInputSchema = z.object({
  title: z.string().min(1).describe('Plan title'),
  body: z.string().describe('Markdown plan body'),
  todos: z.array(planTodoItemSchema).optional().describe('Initial todo items'),
})

export type CreatePlanInput = z.infer<typeof createPlanInputSchema>

export default createPlanInputSchema
