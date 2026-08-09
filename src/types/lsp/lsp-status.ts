export type LspServerDisplayState =
  | 'installing'
  | 'starting'
  | 'running'
  | 'stopped'
  | 'error'
  | 'needs_trust'
  | 'disabled'
  | 'missing'

export type LspHealth = 'busy' | 'error' | 'warning' | 'ok'

export type LspStatusServerRow = {
  id: string
  label: string
  extensions: string[]
  running: boolean
  installed: boolean
  disabled: boolean
  requiresTrust: boolean
  error: string | null
  source: string | null
  installState: string | null
  displayState: LspServerDisplayState
}

export type LspProblemItem = {
  id: string
  uri: string
  path: string
  message: string
  severity: 'error' | 'warning'
  line: number
  character: number
}
