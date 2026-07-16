import { z } from 'zod'

const diffLineSchema = z.object({
  kind: z.enum(['context', 'add', 'remove']),
  content: z.string(),
})

const fileDiffHunkSchema = z.object({
  oldStart: z.number().int(),
  newStart: z.number().int(),
  lines: z.array(diffLineSchema),
})

export const fileDiffSchema = z.object({
  path: z.string(),
  operation: z.enum(['create', 'update', 'delete', 'rename']),
  oldContent: z.string().optional(),
  newContent: z.string().optional(),
  hunks: z.array(fileDiffHunkSchema),
})

export const fileDiffListSchema = z.array(fileDiffSchema)

export type FileDiffInput = z.infer<typeof fileDiffSchema>
