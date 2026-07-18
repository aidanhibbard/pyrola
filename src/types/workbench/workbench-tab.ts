export type WorkbenchTabType =
  | 'changes'
  | 'editor'
  | 'terminal'
  | 'browser'
  | 'studio'
  | 'plan'

export type EditorPayload = {
  path: string
  openPaths: string[]
}

export type TerminalPayload = {
  sessionId: string | null
  cwd?: string | null
}

export type PlanPayload = {
  planId: string
  path: string
}

export type StudioPayload = {
  artifactSlug: string
  path: string
}

export type ChangesPayload = Record<string, never>

export type BrowserPayload = {
  url: string
}

export type WorkbenchTabPayload =
  | EditorPayload
  | TerminalPayload
  | PlanPayload
  | StudioPayload
  | ChangesPayload
  | BrowserPayload

export type WorkbenchTab = {
  id: string
  type: WorkbenchTabType
  projectId: string
  label: string
  dirty?: boolean
  payload: WorkbenchTabPayload
}

export type { PlanFrontmatter, PlanTodoItem, ParsedPlan } from '@/types/plans/plan-document'
