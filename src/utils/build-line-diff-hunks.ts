import type { DiffLine, FileDiffHunk } from '@/types/harness/file-diff'

const CONTEXT_LINES = 3

type DiffOp = {
  kind: DiffLine['kind']
  content: string
  oldIndex: number
  newIndex: number
}

const splitLines = (text: string): string[] => {
  if (text.length === 0) {
    return []
  }
  const lines = text.split(/\r?\n/)
  if (text.endsWith('\n') || text.endsWith('\r')) {
    lines.pop()
  }
  return lines
}

const buildEditScript = (oldLines: string[], newLines: string[]): DiffOp[] => {
  const n = oldLines.length
  const m = newLines.length
  const max = n + m
  const offset = max
  const v = new Int32Array(2 * max + 1).fill(-1)
  v[offset + 1] = 0
  const trace: Int32Array[] = []

  for (let d = 0; d <= max; d += 1) {
    const snapshot = Int32Array.from(v)
    trace.push(snapshot)
    for (let k = -d; k <= d; k += 2) {
      const kIndex = offset + k
      let x: number
      if (k === -d || (k !== d && v[kIndex - 1]! < v[kIndex + 1]!)) {
        x = v[kIndex + 1]!
      } else {
        x = v[kIndex - 1]! + 1
      }
      let y = x - k
      while (x < n && y < m && oldLines[x] === newLines[y]) {
        x += 1
        y += 1
      }
      v[kIndex] = x
      if (x >= n && y >= m) {
        return backtrack(oldLines, newLines, trace, offset)
      }
    }
  }

  return []
}

const backtrack = (
  oldLines: string[],
  newLines: string[],
  trace: Int32Array[],
  offset: number,
): DiffOp[] => {
  const ops: DiffOp[] = []
  let x = oldLines.length
  let y = newLines.length

  for (let d = trace.length - 1; d >= 0; d -= 1) {
    const v = trace[d]!
    const k = x - y
    const kIndex = offset + k
    let prevK: number
    if (k === -d || (k !== d && v[kIndex - 1]! < v[kIndex + 1]!)) {
      prevK = k + 1
    } else {
      prevK = k - 1
    }
    const prevX = v[offset + prevK]!
    const prevY = prevX - prevK

    while (x > prevX && y > prevY) {
      x -= 1
      y -= 1
      ops.push({
        kind: 'context',
        content: oldLines[x]!,
        oldIndex: x,
        newIndex: y,
      })
    }

    if (d === 0) {
      break
    }

    if (x > prevX) {
      x -= 1
      ops.push({
        kind: 'remove',
        content: oldLines[x]!,
        oldIndex: x,
        newIndex: y,
      })
    } else if (y > prevY) {
      y -= 1
      ops.push({
        kind: 'add',
        content: newLines[y]!,
        oldIndex: x,
        newIndex: y,
      })
    }
  }

  ops.reverse()
  return ops
}

const rangeStart1Based = (start: number, len: number): number => {
  if (len === 0) {
    return start
  }
  return start + 1
}

const groupOps = (ops: DiffOp[]): FileDiffHunk[] => {
  if (ops.length === 0) {
    return []
  }

  const changeIndexes: number[] = []
  for (let i = 0; i < ops.length; i += 1) {
    if (ops[i]!.kind !== 'context') {
      changeIndexes.push(i)
    }
  }
  if (changeIndexes.length === 0) {
    return []
  }

  const hunks: FileDiffHunk[] = []
  let groupStart = Math.max(0, changeIndexes[0]! - CONTEXT_LINES)
  let groupEnd = Math.min(ops.length, changeIndexes[0]! + 1 + CONTEXT_LINES)

  for (let c = 1; c < changeIndexes.length; c += 1) {
    const changeIndex = changeIndexes[c]!
    const nextStart = Math.max(0, changeIndex - CONTEXT_LINES)
    if (nextStart <= groupEnd) {
      groupEnd = Math.min(ops.length, changeIndex + 1 + CONTEXT_LINES)
      continue
    }
    hunks.push(sliceHunk(ops, groupStart, groupEnd))
    groupStart = nextStart
    groupEnd = Math.min(ops.length, changeIndex + 1 + CONTEXT_LINES)
  }

  hunks.push(sliceHunk(ops, groupStart, groupEnd))
  return hunks
}

const sliceHunk = (ops: DiffOp[], start: number, end: number): FileDiffHunk => {
  const slice = ops.slice(start, end)
  let oldLen = 0
  let newLen = 0
  for (const op of slice) {
    if (op.kind === 'add') {
      newLen += 1
    } else if (op.kind === 'remove') {
      oldLen += 1
    } else {
      oldLen += 1
      newLen += 1
    }
  }

  const first = slice[0]!
  return {
    oldStart: rangeStart1Based(first.oldIndex, oldLen),
    newStart: rangeStart1Based(first.newIndex, newLen),
    lines: slice.map((op) => ({
      kind: op.kind,
      content: op.content,
    })),
  }
}

export default (oldText: string, newText: string): FileDiffHunk[] => {
  if (oldText === newText) {
    return []
  }
  const oldLines = splitLines(oldText)
  const newLines = splitLines(newText)
  const ops = buildEditScript(oldLines, newLines)
  return groupOps(ops)
}
