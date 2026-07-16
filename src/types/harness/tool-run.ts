export type ToolRun = {
  toolCallId: string
  name: string
  status: 'running' | 'done' | 'error' | 'rejected'
  args?: unknown
  result?: unknown
}
