import { z } from 'zod'

const stdioServerSchema = z.object({
  // Hard allowlist is enforced in Rust mcp_start. Keep schema permissive so
  // migrateMcpConfig does not wipe existing server entries.
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  envFile: z.string().optional(),
  enabled: z.boolean().optional(),
})

const oauthSchema = z
  .object({
    clientId: z.string().min(1).optional(),
    allowedAuthorizationServers: z.array(z.string().url()).optional(),
  })
  .strict()

const httpServerSchema = z.object({
  type: z.enum(['http', 'sse']),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  oauth: oauthSchema.optional(),
  enabled: z.boolean().optional(),
})

const serverSchema = z.union([stdioServerSchema, httpServerSchema])

const inputSchema = z.object({
  id: z.string().min(1),
  type: z.literal('promptString'),
  description: z.string().optional(),
  password: z.boolean().optional(),
})

export const mcpConfigSchema = z.object({
  servers: z.record(serverSchema),
  inputs: z.array(inputSchema).optional(),
})

export const defaultMcpConfig = (): z.infer<typeof mcpConfigSchema> => ({
  servers: {},
})

export const isMcpServerEnabled = (config: { enabled?: boolean }): boolean =>
  config.enabled !== false

export const migrateMcpConfig = (raw: unknown): z.infer<typeof mcpConfigSchema> => {
  if (typeof raw !== 'object' || raw === null) {
    return defaultMcpConfig()
  }

  const parsed = mcpConfigSchema.safeParse(raw)
  if (parsed.success) {
    return parsed.data
  }

  // Recover servers even when oauth/inputs are malformed.
  const record = raw as Record<string, unknown>
  const serversRaw = record.servers
  if (typeof serversRaw !== 'object' || serversRaw === null) {
    return defaultMcpConfig()
  }

  const servers: z.infer<typeof mcpConfigSchema>['servers'] = {}
  for (const [id, value] of Object.entries(serversRaw)) {
    const serverParsed = serverSchema.safeParse(value)
    if (serverParsed.success) {
      servers[id] = serverParsed.data
    }
  }

  const inputsParsed = z.array(inputSchema).safeParse(record.inputs)
  return {
    servers,
    ...(inputsParsed.success && inputsParsed.data.length > 0
      ? { inputs: inputsParsed.data }
      : {}),
  }
}
