import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

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

export const registryUpdateProjectRoot = (
  projectId: string,
  rootPath: string,
): Promise<{
  id: string
  name: string
  slug: string
  root_path: string
  last_opened: string
}> => call('registry_update_project_root', { projectId, rootPath })

export const registryRemoveProject = (projectId: string): Promise<void> =>
  call('registry_remove_project', { projectId })

export const getDefaultWorkspaceRoot = (): Promise<string> =>
  call('get_default_workspace_root')

export const getActiveProjectId = (): Promise<string | null> => call('get_active_project')

export const revealInFolder = (path: string): Promise<void> =>
  call('reveal_in_folder', { path })

export const openFolderPicker = async (): Promise<string | null> => {
  if (!isTauri()) {
    throw new Error('Pyrola desktop APIs are only available in the Tauri app')
  }

  const selected = await open({
    directory: true,
    multiple: false,
  })

  if (selected === null) {
    return null
  }

  return Array.isArray(selected) ? (selected[0] ?? null) : selected
}

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

export const mcpListStatuses = (): Promise<Record<string, McpServerState>> =>
  call('mcp_list_statuses')

export type HttpProxyRequest = {
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
}

export const httpProxyRequest = (
  request: HttpProxyRequest,
): Promise<{ status: number; body: string; headers: Record<string, string> }> =>
  call('http_proxy_request', { request })

export type ChatMetaRecord = {
  id: string
  title: string
  projectSlug: string
  projectRoot: string
  mode: string
  model: string
  status: 'idle' | 'running'
  createdAt: string
  updatedAt: string
  forkedFrom: string | null
  pinned: boolean
  pinnedAt: string | null
}

export const createChat = (args: {
  projectSlug: string
  projectRoot: string
  mode: string
  model: string
  title?: string
}): Promise<ChatMetaRecord> => call('create_chat', args)

export const listChats = (projectSlug: string): Promise<ChatMetaRecord[]> =>
  call('list_chats', { projectSlug })

export const readChatMeta = (
  projectSlug: string,
  chatId: string,
): Promise<ChatMetaRecord> => call('read_chat_meta', { projectSlug, chatId })

export const readChatMessages = (
  projectSlug: string,
  chatId: string,
): Promise<Record<string, unknown>[]> =>
  call('read_chat_messages', { projectSlug, chatId })

export const appendChatLine = (
  projectSlug: string,
  chatId: string,
  line: Record<string, unknown>,
): Promise<void> => call('append_chat_line', { projectSlug, chatId, line })

export const truncateChatLog = (args: {
  projectSlug: string
  chatId: string
  beforeMessageId?: string
  keepThroughLastUser?: boolean
}): Promise<void> => call('truncate_chat_log', args)

export const updateChatMeta = (
  projectSlug: string,
  chatId: string,
  patch: Record<string, unknown>,
): Promise<ChatMetaRecord> => call('update_chat_meta', { projectSlug, chatId, patch })

export const deleteChat = (projectSlug: string, chatId: string): Promise<void> =>
  call('delete_chat', { projectSlug, chatId })

export const forkChat = (projectSlug: string, chatId: string): Promise<ChatMetaRecord> =>
  call('fork_chat', { projectSlug, chatId })

export const pinChat = (
  projectSlug: string,
  chatId: string,
  pinned: boolean,
): Promise<ChatMetaRecord> => call('pin_chat', { projectSlug, chatId, pinned })

export const listPinnedChats = (): Promise<ChatMetaRecord[]> => call('list_pinned_chats')

export const fsReadFile = (args: {
  projectRoot: string
  path: string
  offset?: number
  limit?: number
  includeBase64?: boolean
}): Promise<{
  path: string
  content: string
  totalLines: number
  offset: number
  limit: number
  isImage?: boolean
  mimeType?: string
  sizeBytes?: number
  base64?: string
}> => call('fs_read_file', args)

export const fsWriteFile = (args: {
  projectRoot: string
  path: string
  content: string
}): Promise<unknown> => call('fs_write_file', args)

export type FsEditReplacement = {
  oldString: string
  newString: string
  replaceAll?: boolean
}

export type FileDiffRecord = {
  path: string
  operation: string
  oldContent?: string
  newContent?: string
  hunks: Array<{
    oldStart: number
    newStart: number
    lines: Array<{ kind: string; content: string }>
  }>
}

export const fsEditFile = (args: {
  projectRoot: string
  path: string
  replacements: FsEditReplacement[]
}): Promise<FileDiffRecord> => call('fs_edit_file', args)

export const fsApplyPatch = (args: {
  projectRoot: string
  patch: string
}): Promise<unknown> => call('fs_apply_patch', args)

export const fsListDir = (
  projectRoot: string,
  path: string,
): Promise<Array<{ name: string; path: string; kind: string }>> =>
  call('fs_list_dir', { projectRoot, path })

export const fsListDirTree = (
  projectRoot: string,
  path: string,
  depth?: number,
): Promise<unknown> => call('fs_list_dir_tree', { projectRoot, path, depth })

export const fsRename = (args: {
  projectRoot: string
  from: string
  to: string
}): Promise<void> => call('fs_rename', args)

export const fsDelete = (args: {
  projectRoot: string
  path: string
  recursive?: boolean
}): Promise<void> => call('fs_delete', args)

export const fsCopy = (args: {
  projectRoot: string
  from: string
  to: string
}): Promise<void> => call('fs_copy', args)

export const fsMove = (args: {
  projectRoot: string
  from: string
  to: string
}): Promise<void> => call('fs_move', args)

export const fsMkdir = (args: {
  projectRoot: string
  path: string
}): Promise<void> => call('fs_mkdir', args)

export const fsStagePreviewWrite = (args: {
  projectRoot: string
  path: string
  content: string
}): Promise<FileDiffRecord[]> =>
  call('fs_stage_preview', {
    projectRoot: args.projectRoot,
    request: { kind: 'write', path: args.path, content: args.content },
  })

export const fsStagePreviewEdit = (args: {
  projectRoot: string
  path: string
  replacements: FsEditReplacement[]
}): Promise<FileDiffRecord[]> =>
  call('fs_stage_preview', {
    projectRoot: args.projectRoot,
    request: { kind: 'edit', path: args.path, replacements: args.replacements },
  })

export const fsStagePreviewApplyPatch = (args: {
  projectRoot: string
  patch: string
}): Promise<FileDiffRecord[]> =>
  call('fs_stage_preview', {
    projectRoot: args.projectRoot,
    request: { kind: 'applyPatch', patch: args.patch },
  })

export const fsStagePreviewDelete = (args: {
  projectRoot: string
  path: string
}): Promise<FileDiffRecord[]> =>
  call('fs_stage_preview', {
    projectRoot: args.projectRoot,
    request: { kind: 'delete', path: args.path },
  })

export type GrepMatch = {
  path: string
  lineNumber: number
  line: string
  contextBefore?: string[]
  contextAfter?: string[]
}

export type WorkspaceGrepResult = {
  matches: GrepMatch[]
  truncated: boolean
}

export const workspaceGrep = async (args: {
  projectRoot: string
  pattern: string
  glob?: string
  context?: number
  path?: string
  caseInsensitive?: boolean
  maxResults?: number
}): Promise<WorkspaceGrepResult> => {
  const result = await call<WorkspaceGrepResult>('workspace_grep', { request: args })
  return result
}

export type GlobFileEntry = {
  path: string
  modifiedMs?: number
}

export type WorkspaceGlobResult = {
  files: GlobFileEntry[]
  truncated: boolean
}

export const workspaceGlob = async (
  projectRoot: string,
  pattern: string,
  limit?: number,
): Promise<WorkspaceGlobResult> => {
  const result = await call<WorkspaceGlobResult>('workspace_glob', {
    request: { projectRoot, pattern, limit },
  })
  return result
}

export const gitStatus = (
  projectRoot: string,
): Promise<{ branch: string | null; entries: unknown[] }> =>
  call('git_status', { projectRoot })

export const gitDiff = (args: {
  projectRoot: string
  path?: string
  staged?: boolean
}): Promise<{ diff: string }> => call('git_diff', args)

export const gitLog = (
  projectRoot: string,
  limit?: number,
): Promise<{ commits: Array<{ hash: string; subject: string }> }> =>
  call('git_log', { projectRoot, limit })

export const gitListBranches = (projectRoot: string): Promise<string[]> =>
  call('git_list_branches', { rootPath: projectRoot })

export const gitCheckoutBranch = (projectRoot: string, branch: string): Promise<void> =>
  call('git_checkout_branch', { rootPath: projectRoot, branch })

export type GitCommitResult = {
  hash: string
  message: string
  output: string
}

export const gitCommit = (args: {
  projectRoot: string
  message: string
  paths?: string[]
}): Promise<GitCommitResult> => call('git_commit', args)

export const gitBranchCreate = (args: {
  projectRoot: string
  name: string
  checkout?: boolean
}): Promise<void> => call('git_branch_create', args)

export const mcpCallTool = (
  serverId: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<unknown> => call('mcp_call_tool', { serverId, tool, args })

export const shellSpawnPty = (args: {
  projectRoot: string
  cols: number
  rows: number
  cwd?: string
}): Promise<{ sessionId: string }> => call('shell_spawn_pty', args)

export const shellWritePty = (sessionId: string, data: string): Promise<void> =>
  call('shell_write_pty', { sessionId, data })

export const shellResizePty = (
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> => call('shell_resize_pty', { sessionId, cols, rows })

export const shellKillPty = (sessionId: string): Promise<void> =>
  call('shell_kill_pty', { sessionId })

export type ShellRunResult = {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
}

export const shellRunCommand = (args: {
  projectRoot: string
  command: string
  timeoutMs?: number
}): Promise<ShellRunResult> => call('shell_run_command', args)

export const shellSpawnTracked = (args: {
  shellId: string
  projectRoot: string
  command: string
}): Promise<void> => call('shell_spawn_tracked', args)

export const shellKillTracked = (shellId: string): Promise<number> =>
  call('shell_kill_tracked', { shellId })

export const lspStatus = (): Promise<Array<{ id: string; running: boolean; error?: string | null }>> =>
  call('lsp_status')

export const lspRequest = (
  serverId: string,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> => call('lsp_request', { serverId, method, params })

export const lspEnsureServer = (
  extension: string,
  projectRoot?: string | null,
): Promise<{ id: string; running: boolean; error?: string | null }> =>
  call('lsp_ensure_server', { extension, projectRoot: projectRoot ?? null })

export const lspStopServer = (serverId: string): Promise<void> =>
  call('lsp_stop_server', { serverId })
