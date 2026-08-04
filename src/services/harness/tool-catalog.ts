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
  load_skill: 'Load a project skill by name',
  ask_user: 'Ask the user a clarifying question',
  call_mcp_tool: 'Invoke a tool on a configured MCP server',
  get_mcp_tools: 'List configured MCP servers and their tools',
  create_plan: 'Create a plan document',
  update_plan_todo: 'Update a plan todo item',
  write_studio_artifact: 'Write a studio artifact',
  spawn_subagent: 'Spawn sub-agent',
  browser_tabs: 'List, select, or close shared browser tabs',
  browser_navigate: 'Navigate the shared browser to a URL',
  browser_lock: 'Lock or unlock a browser tab for this chat',
  browser_snapshot: 'Accessibility snapshot with refs for the page',
  browser_take_screenshot: 'Capture a browser screenshot (vision models receive the image)',
  browser_click: 'Click an element by snapshot ref',
  browser_hover: 'Hover an element by snapshot ref',
  browser_type: 'Type text into an element by ref',
  browser_fill: 'Fill an input by ref',
  browser_select_option: 'Select option(s) in a select by ref',
  browser_press_key: 'Press a key in the browser tab',
  browser_scroll: 'Scroll the page or an element',
  browser_drag: 'Drag from one ref to another',
  browser_highlight: 'Highlight an element by ref',
  browser_get_bounding_box: 'Get bounding box for a ref',
}

export const formatToolCatalogForMode = (mode: PyrolaChatMode): string => {
  const lines = MODE_TOOL_ALLOWLIST[mode].map((name) => {
    const description = TOOL_DESCRIPTIONS[name] ?? name.replaceAll('_', ' ')
    return `- ${name}: ${description}`
  })
  return lines.join('\n')
}
