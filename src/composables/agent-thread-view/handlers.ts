import { createSubmitHandlers } from './handlers-submit'
import { createShellMcpHandlers } from './handlers-shell-mcp'
import type { AgentThreadViewState } from './types'

export const createHandlers = (state: AgentThreadViewState) => ({
  ...createSubmitHandlers(state),
  ...createShellMcpHandlers(state),
})

export type AgentThreadHandlers = ReturnType<typeof createHandlers>
