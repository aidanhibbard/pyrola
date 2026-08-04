import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'

const ASK_TOOLS = [
  'read_file',
  'grep',
  'glob_files',
  'list_dir',
  'git_status',
  'git_diff',
  'git_log',
  'git_branch',
  'lsp',
  'diagnostics',
  'load_skill',
  'ask_user',
  'browser_tabs',
  'browser_snapshot',
  'browser_take_screenshot',
] as const

const PLAN_TOOLS = [
  ...ASK_TOOLS,
  'create_plan',
  'update_plan_todo',
] as const

const ORCHESTRATOR_TOOLS = [
  'read_file',
  'list_dir',
  'grep',
  'glob_files',
  'git_status',
  'git_diff',
  'git_log',
  'git_branch',
  'lsp',
  'diagnostics',
  'load_skill',
  'ask_user',
  'call_mcp_tool',
  'get_mcp_tools',
  'create_plan',
  'update_plan_todo',
  'spawn_subagent',
] as const

export const MODE_TOOL_ALLOWLIST: Record<PyrolaChatMode, string[]> = {
  ask: [...ASK_TOOLS],
  plan: [...PLAN_TOOLS],
  studio: [
    ...PLAN_TOOLS,
    'write_studio_artifact',
  ],
  agent: [
    'read_file',
    'write_file',
    'edit_file',
    'apply_patch',
    'delete_file',
    'move_file',
    'grep',
    'glob_files',
    'list_dir',
    'git_status',
    'git_diff',
    'git_log',
    'git_branch',
    'git_checkout',
    'git_branch_create',
    'git_commit',
    'lsp',
    'diagnostics',
    'run_terminal',
    'terminal_output',
    'stop_terminal',
    'load_skill',
    'ask_user',
    'call_mcp_tool',
    'get_mcp_tools',
    'create_plan',
    'update_plan_todo',
    'write_studio_artifact',
    'spawn_subagent',
    'browser_tabs',
    'browser_navigate',
    'browser_lock',
    'browser_snapshot',
    'browser_take_screenshot',
    'browser_click',
    'browser_hover',
    'browser_type',
    'browser_fill',
    'browser_select_option',
    'browser_press_key',
    'browser_scroll',
    'browser_drag',
    'browser_highlight',
    'browser_get_bounding_box',
  ],
  orchestrator: [...ORCHESTRATOR_TOOLS],
}

export const filterToolsByMode = <T extends { name: string }>(
  mode: PyrolaChatMode,
  tools: T[],
): T[] => {
  const allow = new Set(MODE_TOOL_ALLOWLIST[mode])
  return tools.filter((tool) => allow.has(tool.name))
}
