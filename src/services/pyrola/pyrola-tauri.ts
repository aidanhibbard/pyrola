import { invoke } from '@tauri-apps/api/core'

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const call = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  if (!isTauri()) {
    throw new Error('Pyrola desktop APIs are only available in the Tauri app')
  }
  return invoke<T>(command, args)
}

export type ConfigScope = 'personal' | 'project'

export const getUserPyrolaDir = (): Promise<string> => call('get_user_pyrola_dir')

export const hasProjectPyrola = (rootPath: string): Promise<boolean> =>
  call('has_project_pyrola', { rootPath })

export const readSettings = (
  scope: ConfigScope,
  rootPath?: string | null,
): Promise<Record<string, unknown>> =>
  call('read_settings', { scope, rootPath: rootPath ?? null })

export const writeSettings = (
  scope: ConfigScope,
  settings: Record<string, unknown>,
  rootPath?: string | null,
): Promise<void> =>
  call('write_settings', { scope, settings, rootPath: rootPath ?? null })

export const readMcpConfig = (
  scope: ConfigScope,
  rootPath?: string | null,
): Promise<Record<string, unknown>> =>
  call('read_mcp_config', { scope, rootPath: rootPath ?? null })

export const writeMcpConfig = (
  scope: ConfigScope,
  config: Record<string, unknown>,
  rootPath?: string | null,
): Promise<void> =>
  call('write_mcp_config', { scope, config, rootPath: rootPath ?? null })

export const watchPyrolaPaths = (projectRoot?: string | null): Promise<void> =>
  call('watch_pyrola_paths', { projectRoot: projectRoot ?? null })

export const getSecret = (key: string): Promise<string | null> =>
  call('get_secret', { key })

export const setSecret = (key: string, value: string): Promise<void> =>
  call('set_secret', { key, value })

export const deleteSecret = (key: string): Promise<void> => call('delete_secret', { key })

export type FleetProjectRecord = {
  id: string
  name: string
  slug: string
  rootPath: string
  lastOpened: string
}

export const registryListProjects = (): Promise<
  Array<{
    id: string
    name: string
    slug: string
    root_path: string
    last_opened: string
  }>
> => call('registry_list_projects')

export const registryAddProject = (
  name: string,
  rootPath: string,
): Promise<{
  id: string
  name: string
  slug: string
  root_path: string
  last_opened: string
}> => call('registry_add_project', { name, rootPath })

export const registrySetActiveProject = (projectId: string | null): Promise<void> =>
  call('registry_set_active_project', { projectId })

export const getActiveProjectId = (): Promise<string | null> => call('get_active_project')

export const revealInFolder = (path: string): Promise<void> =>
  call('reveal_in_folder', { path })

export type ProjectFileEntry = {
  name: string
  path: string
  description?: string | null
}

export const getPyrolaDir = (
  scope: ConfigScope,
  rootPath?: string | null,
): Promise<string> => call('get_pyrola_dir', { scope, rootPath: rootPath ?? null })

export type PyrolaFilesKind = 'agents' | 'rules' | 'skills' | 'plans' | 'studio'

export const listPyrolaFiles = (
  scope: ConfigScope,
  kind: PyrolaFilesKind,
  rootPath?: string | null,
): Promise<ProjectFileEntry[]> =>
  call('list_pyrola_files', { scope, kind, rootPath: rootPath ?? null })

export const listProjectFiles = (
  rootPath: string,
  kind: 'agents' | 'rules' | 'skills',
): Promise<ProjectFileEntry[]> => call('list_project_files', { rootPath, kind })

export type McpToolInfo = {
  name: string
  description?: string | null
  inputSchema?: Record<string, unknown> | null
}

export type McpServerState = {
  serverId: string
  status: string
  error?: string | null
  tools: McpToolInfo[]
}

export const mcpStart = (
  serverId: string,
  command: string,
  args: string[],
): Promise<McpServerState> => call('mcp_start', { serverId, command, args })

export const mcpStop = (serverId: string): Promise<void> => call('mcp_stop', { serverId })

export const mcpRefresh = (serverId: string): Promise<McpServerState> =>
  call('mcp_refresh', { serverId })

export const mcpLogout = (serverId: string): Promise<void> => call('mcp_logout', { serverId })

export const mcpStatus = (serverId: string): Promise<McpServerState> =>
  call('mcp_status', { serverId })

export type HttpProxyRequest = {
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
}

export const httpProxyRequest = (
  request: HttpProxyRequest,
): Promise<{ status: number; body: string }> => call('http_proxy_request', { request })
