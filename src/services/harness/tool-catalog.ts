import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import { MODE_TOOL_ALLOWLIST } from '@/services/harness/mode-allowlists'

export const TOOL_DESCRIPTIONS: Record<string, string> = {
  read_file: 'Read a file from the project workspace',
  write_file: 'Create or overwrite a file',
  edit_file: 'Edit a file with search/replace',
  apply_patch: 'Apply an OpenCode-style multi-file patch',
  delete_file: 'Delete a file from the workspace',
  move_file: 'Move or rename a workspace file',
  list_dir: 'List directory contents',
  glob_files: 'Find files by glob pattern',
  grep: 'Search file contents with regex',
  git_status: 'Show git working tree status',
  git_diff: 'Show git diff',
  git_log: 'Show git commit history',
  git_branch: 'Show current git branch',
  git_checkout: 'Checkout a git branch or ref',
  git_branch_create: 'Create a new git branch',
  git_commit: 'Stage and commit changes',
  lsp: 'Query language server (definitions, references, diagnostics, etc.)',
  diagnostics: 'Read linter and diagnostic errors for a file',
  run_terminal: 'Run a shell command in the project',
  terminal_output: 'Read output from a background agent shell',
  stop_terminal: 'Stop a background agent shell',
  web_fetch: 'Fetch a URL',
  web_search: 'Search the web for real-time information',
  load_skill: 'Load a project skill by name',
  ask_user: 'Ask the user a clarifying question',
  call_mcp_tool: 'Invoke a tool on a configured MCP server',
  get_mcp_tools: 'List configured MCP servers and their tools',
  create_plan: 'Create a plan document',
  update_plan_todo: 'Update a plan todo item',
  write_studio_artifact: 'Write a studio artifact',
  spawn_subagent: 'Spawn sub-agent',
}

export const formatToolCatalogForMode = (mode: PyrolaChatMode): string => {
  const lines = MODE_TOOL_ALLOWLIST[mode].map((name) => {
    const description = TOOL_DESCRIPTIONS[name] ?? name.replaceAll('_', ' ')
    return `- ${name}: ${description}`
  })
  return lines.join('\n')
}
