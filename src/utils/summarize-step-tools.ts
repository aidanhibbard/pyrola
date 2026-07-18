import type { ToolRun } from '@/types/harness/tool-run'
import formatToolRunLabel from '@/utils/format-tool-run-label'

const TOOL_CATEGORY: Record<string, 'file' | 'search' | 'git' | 'command' | 'tool'> = {
  read_file: 'file',
  write_file: 'file',
  edit_file: 'file',
  apply_patch: 'file',
  delete_file: 'file',
  move_file: 'file',
  list_dir: 'file',
  glob_files: 'search',
  grep: 'search',
  git_status: 'git',
  git_diff: 'git',
  git_log: 'git',
  git_branch: 'git',
  git_checkout: 'git',
  git_branch_create: 'git',
  git_commit: 'git',
  run_terminal: 'command',
  terminal_output: 'command',
  stop_terminal: 'command',
  call_mcp_tool: 'command',
  get_mcp_tools: 'tool',
  web_fetch: 'tool',
  web_search: 'search',
  create_plan: 'tool',
  update_plan_todo: 'tool',
  spawn_subagent: 'tool',
  lsp: 'tool',
  diagnostics: 'tool',
}

const CATEGORY_LABELS: Record<
  'file' | 'search' | 'git' | 'command' | 'tool',
  [string, string]
> = {
  file: ['file', 'files'],
  search: ['search', 'searches'],
  git: ['git check', 'git checks'],
  command: ['command', 'commands'],
  tool: ['tool', 'tools'],
}

const formatCount = (count: number, singular: string, plural: string): string =>
  count === 1 ? `1 ${singular}` : `${count} ${plural}`

export default (tools: ToolRun[]): string => {
  const settled = tools.filter((tool) => tool.status !== 'running')
  if (settled.length === 0) {
    return 'Working…'
  }
  if (settled.length === 1) {
    return formatToolRunLabel(settled[0]!)
  }
  if (settled.length === 2) {
    return settled.map((tool) => formatToolRunLabel(tool)).join(', ')
  }

  const buckets = new Map<'file' | 'search' | 'git' | 'command' | 'tool', number>()
  for (const tool of settled) {
    const category = TOOL_CATEGORY[tool.name] ?? 'tool'
    buckets.set(category, (buckets.get(category) ?? 0) + 1)
  }

  const parts = Array.from(buckets.entries()).map(([category, count]) => {
    const [singular, plural] = CATEGORY_LABELS[category]
    return formatCount(count, singular, plural)
  })

  return `Explored ${parts.join(', ')}`
}
