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
  codebase_explore: 'Explore CodeGraph for architecture, flows, and structural context',
  codebase_search: 'Search CodeGraph symbols by name (locations only)',
  codebase_impact: 'Analyze CodeGraph blast radius for a symbol change',
  codebase_status: 'Check CodeGraph index health and sync status',
  git_status: 'Show git working tree status',
  git_diff: 'Show git diff',
  git_log: 'Show git commit history',
  git_branch: 'Show current git branch',
  git_checkout: 'Checkout a git branch or ref',
  git_branch_create: 'Create a new git branch',
  git_commit: 'Stage and commit changes',
  lsp: 'Query language server (goToDefinition, findReferences, hover, symbols, workspaceSymbol, diagnostics). Use 0-based position for defs/refs/hover and query for workspaceSymbol. Prefer codebase_* for structural discovery; prefer over grep for precise symbols.',
  diagnostics: 'Read linter and diagnostic errors for a file',
  run_terminal: 'Run a shell command in the project',
  terminal_output: 'Read output from a background agent shell (not subagent ids)',
  stop_terminal: 'Stop a background agent shell',
  load_skill: 'Load a project skill by name',
  ask_user: 'Ask the user a clarifying question',
  call_mcp_tool: 'Invoke a tool on a configured MCP server',
  get_mcp_tools: 'List configured MCP servers and their tools',
  list_mcp_resources: 'List resources from a connected HTTP or SSE MCP server',
  read_mcp_resource: 'Read a resource URI from an MCP server',
  get_mcp_prompt: 'Retrieve a prompt template from an MCP server',
  create_plan: 'Create a plan document',
  update_plan_todo: 'Update a plan todo item',
  write_todos: 'Replace the in-chat todo list (Tasks UI)',
  write_studio_artifact: 'Write a studio artifact',
  spawn_subagent: 'Spawn sub-agent (background: end turn, harness resumes)',
  resolve_models:
    'Look up allowed model refs by query and optional provider (capped)',
  browser_tabs: 'List or select CEF browser sessions (workbench Browser tabs)',
  browser_navigate: 'Navigate a CEF browser session to a URL (auto-acquires per-session lock when free)',
  browser_lock: 'Acquire or release a per-session CEF browser lock for this chat',
  browser_snapshot: 'Capture an accessibility snapshot of a CEF browser session',
  browser_take_screenshot: 'Capture a PNG screenshot of a CEF browser session or an element',
  browser_click: 'Click an element by snapshot ref',
  browser_type: 'Type text into an element by snapshot ref',
  browser_fill: 'Clear and fill an input by snapshot ref',
  browser_select_option: 'Select an option on a select element by snapshot ref',
  browser_press_key: 'Press a key in a CEF browser session',
  browser_scroll: 'Scroll the page or an element into view',
  browser_drag: 'Drag from a source ref to a target ref or coordinates',
  browser_get_bounding_box: 'Get the bounding box for a snapshot ref',
  browser_highlight: 'Briefly highlight an element by snapshot ref',
  browser_cdp: 'Send a raw Chrome DevTools Protocol method (restricted denylist)',
  web_fetch:
    'Fetch an http(s) URL as markdown, text, or html (not the CEF browser; use browser_* for JS SPAs)',
}

export const formatToolCatalogForMode = (mode: PyrolaChatMode): string => {
  const lines = MODE_TOOL_ALLOWLIST[mode].map((name) => {
    const description = TOOL_DESCRIPTIONS[name] ?? name.replaceAll('_', ' ')
    return `- ${name}: ${description}`
  })
  return lines.join('\n')
}
