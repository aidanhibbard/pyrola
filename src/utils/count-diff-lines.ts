import type { FileDiffHunk } from '@/types/harness/file-diff'

export default (hunks: FileDiffHunk[]): { additions: number; deletions: number } => {
  let additions = 0
  let deletions = 0
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.kind === 'add') {
        additions += 1
      } else if (line.kind === 'remove') {
        deletions += 1
      }
    }
  }
  return { additions, deletions }
}
