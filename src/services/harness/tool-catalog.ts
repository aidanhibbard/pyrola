import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import { MODE_TOOL_ALLOWLIST } from '@/services/harness/mode-allowlists'

export const TOOL_DESCRIPTIONS: Record<string, string> = {
  read_file: 'Read a file from the project workspace',
  write_file: 'Create or overwrite a file',
  edit_file: 'Edit a file with search/replace',
  apply_patch: 'Apply an OpenCode-style multi-file patch',
  list_dir: 'List directory contents',
  glob_files: 'Find files by glob pattern',
  grep: 'Search file contents with regex',
  git_status: 'Show git working tree status',
  git_diff: 'Show git diff',
  git_log: 'Show git commit history',
  git_branch: 'List or switch git branches',
  lsp: 'Query language server (definitions, references, etc.)',
  run_terminal: 'Run a shell command in the project',
  web_fetch: 'Fetch a URL',
  web_search: 'Search the web',
  load_skill: 'Load a project skill by name',
  ask_user: 'Ask the user a clarifying question',
  call_mcp_tool: 'Invoke a tool on a configured MCP server',
  get_mcp_tools: 'List configured MCP servers and their tools',
  create_plan: 'Create a plan document',
  update_plan_todo: 'Update a plan todo item',
  write_studio_artifact: 'Write a studio artifact',
  spawn_subagent: 'Run a blocking subagent',
}

export const formatToolCatalogForMode = (mode: PyrolaChatMode): string => {
  const lines = MODE_TOOL_ALLOWLIST[mode].map((name) => {
    const description = TOOL_DESCRIPTIONS[name] ?? name.replaceAll('_', ' ')
    return `- ${name}: ${description}`
  })
  return lines.join('\n')
}
