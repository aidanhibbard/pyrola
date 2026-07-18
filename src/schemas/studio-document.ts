import { z } from 'zod'

export const studioArtifactStatusSchema = z.enum(['draft', 'published'])

export const studioDocTypeSchema = z.enum(['brief', 'report', 'rfc', 'memo', 'dashboard'])

export const studioFrontmatterSchema = z
  .object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    status: studioArtifactStatusSchema.optional(),
    dateRange: z.string().optional(),
    source: z.string().optional(),
    docType: studioDocTypeSchema.optional(),
    slug: z.string().optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'published' && !data.title) {
      ctx.addIssue({
        code: 'custom',
        message: 'title is required when status is published',
        path: ['title'],
      })
    }
  })

export const formatStudioSchemaError = (error: z.ZodError): string =>
  error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
