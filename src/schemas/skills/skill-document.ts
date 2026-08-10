import { z } from 'zod'

export const skillFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
})

export const createSkillInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  body: z.string(),
})

export type SkillFrontmatter = z.infer<typeof skillFrontmatterSchema>
export type CreateSkillInput = z.infer<typeof createSkillInputSchema>
