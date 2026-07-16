export type DiffLineKind = 'context' | 'add' | 'remove'

export type DiffLine = {
  kind: DiffLineKind
  content: string
}

export type FileDiffHunk = {
  oldStart: number
  newStart: number
  lines: DiffLine[]
}

export type FileDiffOperation = 'create' | 'update' | 'delete' | 'rename'

export type FileDiff = {
  path: string
  operation: FileDiffOperation
  oldContent?: string
  newContent?: string
  hunks: FileDiffHunk[]
}
