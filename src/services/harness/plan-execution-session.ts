import type { AwaitingPlanGo } from '@/types/plans/awaiting-plan-go'

export type PlanExecutionSession = {
  awaitingPlanGo: AwaitingPlanGo | null
  subagentModel: string | null
  createdPlanThisTurn: boolean
}

const sessions = new Map<string, PlanExecutionSession>()

export const planExecutionSessionKey = (
  projectSlug: string,
  chatId: string,
): string => `${projectSlug}::${chatId}`

export const getPlanExecutionSession = (
  projectSlug: string,
  chatId: string,
): PlanExecutionSession => {
  const key = planExecutionSessionKey(projectSlug, chatId)
  const existing = sessions.get(key)
  if (existing) {
    return existing
  }

  const created: PlanExecutionSession = {
    awaitingPlanGo: null,
    subagentModel: null,
    createdPlanThisTurn: false,
  }
  sessions.set(key, created)
  return created
}

export const hydratePlanExecutionSession = (
  projectSlug: string,
  chatId: string,
  patch: {
    awaitingPlanGo?: AwaitingPlanGo | null
    subagentModel?: string | null
  },
): PlanExecutionSession => {
  const session = getPlanExecutionSession(projectSlug, chatId)
  if (patch.awaitingPlanGo !== undefined) {
    session.awaitingPlanGo = patch.awaitingPlanGo
  }
  if (patch.subagentModel !== undefined) {
    session.subagentModel = patch.subagentModel
  }
  return session
}

export const beginPlanExecutionTurn = (
  projectSlug: string,
  chatId: string,
): PlanExecutionSession => {
  const session = getPlanExecutionSession(projectSlug, chatId)
  session.createdPlanThisTurn = false
  return session
}

export const markCreatedPlanThisTurn = (
  projectSlug: string,
  chatId: string,
  awaiting: AwaitingPlanGo,
): void => {
  const session = getPlanExecutionSession(projectSlug, chatId)
  session.awaitingPlanGo = awaiting
  session.createdPlanThisTurn = true
}

export const clearAwaitingPlanGo = (
  projectSlug: string,
  chatId: string,
): void => {
  const session = getPlanExecutionSession(projectSlug, chatId)
  session.awaitingPlanGo = null
}

export const setSubagentModelLock = (
  projectSlug: string,
  chatId: string,
  model: string | null,
): void => {
  getPlanExecutionSession(projectSlug, chatId).subagentModel = model
}

export const isAwaitingPlanGo = (
  projectSlug: string,
  chatId: string,
): boolean => Boolean(getPlanExecutionSession(projectSlug, chatId).awaitingPlanGo)

export const PLAN_GO_BLOCKED_TOOLS = new Set([
  'write_file',
  'edit_file',
  'apply_patch',
  'delete_file',
  'move_file',
  'run_terminal',
  'terminal_output',
  'stop_terminal',
  'git_checkout',
  'git_branch_create',
  'git_commit',
  'call_mcp_tool',
  'get_mcp_tools',
  'list_mcp_resources',
  'read_mcp_resource',
  'get_mcp_prompt',
  'spawn_subagent',
  'write_studio_artifact',
])

export const assertNotAwaitingPlanGo = (
  projectSlug: string,
  chatId: string,
): void => {
  const awaiting = getPlanExecutionSession(projectSlug, chatId).awaitingPlanGo
  if (!awaiting) {
    return
  }
  throw new Error(
    `Plan awaiting user Go. Use Build now or Orchestrate on the plan tab before making changes (${awaiting.planPath}).`,
  )
}
