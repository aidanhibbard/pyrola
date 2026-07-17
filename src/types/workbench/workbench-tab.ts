export type WorkbenchTabType =
  | 'changes'
  | 'editor'
  | 'terminal'
  | 'browser'
  | 'studio'
  | 'plan'

export type EditorPayload = {
  path: string | null
}

export type TerminalPayload = {
  sessionId: string | null
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

export type PlanTodoItem = {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
}

export type PlanFrontmatter = {
  id: string
  title: string
  createdAt: string
  mode?: string
  sourceChatId?: string
  todos: PlanTodoItem[]
}

export type ParsedPlan = {
  frontmatter: PlanFrontmatter
  body: string
}
