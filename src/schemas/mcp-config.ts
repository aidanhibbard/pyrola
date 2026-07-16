import { z } from 'zod'

const stdioServerSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  envFile: z.string().optional(),
})

const httpServerSchema = z.object({
  type: z.enum(['http', 'sse']),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  oauth: z.record(z.unknown()).optional(),
})

const serverSchema = z.union([stdioServerSchema, httpServerSchema])

export const mcpConfigSchema = z.object({
  servers: z.record(serverSchema),
})

export const defaultMcpConfig = (): z.infer<typeof mcpConfigSchema> => ({
  servers: {},
})

export const migrateMcpConfig = (raw: unknown): z.infer<typeof mcpConfigSchema> => {
  if (typeof raw !== 'object' || raw === null) {
    return defaultMcpConfig()
  }

  const parsed = mcpConfigSchema.safeParse(raw)
  if (parsed.success) {
    return parsed.data
  }

  return defaultMcpConfig()
}
