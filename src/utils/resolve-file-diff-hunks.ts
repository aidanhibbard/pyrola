import type { FileDiff, FileDiffHunk } from '@/types/harness/file-diff'
import buildLineDiffHunks from '@/utils/build-line-diff-hunks'

export default (diff: FileDiff): FileDiffHunk[] => {
  if (diff.operation === 'rename') {
    return diff.hunks
  }
  if (
    typeof diff.oldContent === 'string' ||
    typeof diff.newContent === 'string'
  ) {
    return buildLineDiffHunks(diff.oldContent ?? '', diff.newContent ?? '')
  }
  return diff.hunks
}
