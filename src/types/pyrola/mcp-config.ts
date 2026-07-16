export type McpStdioServer = {
  command: string
  args?: string[]
  env?: Record<string, string>
  envFile?: string
}

export type McpHttpServer = {
  type: 'http' | 'sse'
  url: string
  headers?: Record<string, string>
  oauth?: Record<string, unknown>
}

export type McpServerConfig = McpStdioServer | McpHttpServer

export type McpConfig = {
  servers: Record<string, McpServerConfig>
}

export type McpServerScope = 'personal' | 'project' | 'overridden'

export type McpServerStatus =
  | 'connected'
  | 'starting'
  | 'stopped'
  | 'error'
  | 'auth_required'
  | 'refreshing'

export type McpToolDescriptor = {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}
