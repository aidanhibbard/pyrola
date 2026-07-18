import type { ToolRun } from '@/types/harness/tool-run'

const TOOL_LABELS: Record<string, string> = {
  read_file: 'Read',
  write_file: 'Edited',
  edit_file: 'Edited',
  apply_patch: 'Patched',
  list_dir: 'Listed',
  glob_files: 'Searched files',
  grep: 'Searched',
  git_status: 'Checked git status',
  git_diff: 'Viewed diff',
  git_log: 'Viewed git log',
  git_branch: 'Checked branch',
  run_terminal: 'Ran command',
  terminal_output: 'Read shell output',
  stop_terminal: 'Stopped shell',
  web_fetch: 'Fetched URL',
  call_mcp_tool: 'Called MCP tool',
  get_mcp_tools: 'Listed MCP tools',
  create_plan: 'Created plan',
  update_plan_todo: 'Updated plan',
  spawn_subagent: 'Spawned sub-agent',
  lsp: 'LSP lookup',
}

const formatArgsHint = (args: unknown): string | null => {
  if (!args || typeof args !== 'object') {
    return null
  }
  const record = args as Record<string, unknown>
  if (typeof record.path === 'string' && record.path.length > 0) {
    return record.path
  }
  if (typeof record.pattern === 'string' && record.pattern.length > 0) {
    return record.pattern
  }
  if (typeof record.agentName === 'string' && record.agentName.length > 0) {
    return record.agentName
  }
  if (typeof record.command === 'string' && record.command.length > 0) {
    return record.command
  }
  return null
}

export default (run: ToolRun): string => {
  const prefix = TOOL_LABELS[run.name] ?? run.name.replaceAll('_', ' ')
  const hint = formatArgsHint(run.args)
  const target = hint ? ` ${hint}` : ''

  if (run.status === 'running') {
    return `${prefix}${target}…`
  }
  if (run.status === 'rejected') {
    return `${prefix}${target} (rejected)`
  }
  if (run.status === 'error') {
    return `${prefix}${target} (failed)`
  }
  return `${prefix}${target}`
}
