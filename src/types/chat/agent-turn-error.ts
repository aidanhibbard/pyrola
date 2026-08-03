export type AgentTurnErrorKind = 'error' | 'timeout' | 'aborted'

export type AgentTurnError = {
  kind: AgentTurnErrorKind
  message: string
}
