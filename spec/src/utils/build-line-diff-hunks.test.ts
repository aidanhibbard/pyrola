import { describe, expect, it } from 'vitest'
import buildLineDiffHunks from '@/utils/build-line-diff-hunks'
import countDiffLines from '@/utils/count-diff-lines'
import filePathBasename from '@/utils/file-path-basename'
import formatToolRunLabel from '@/utils/format-tool-run-label'
import resolveFileDiffHunks from '@/utils/resolve-file-diff-hunks'
import type { FileDiff } from '@/types/harness/file-diff'
import type { ToolRun } from '@/types/harness/tool-run'

const toolRun = (partial: Partial<ToolRun> & Pick<ToolRun, 'name'>): ToolRun => ({
  toolCallId: 'call-1',
  status: 'done',
  ...partial,
})

describe('buildLineDiffHunks', () => {
  it('returns empty hunks when texts match', () => {
    expect(buildLineDiffHunks('a\nb\n', 'a\nb\n')).toEqual([])
  })

  it('focuses a middle-of-file change', () => {
    const oldText = 'line1\nline2\nline3\nline4\nline5\nline6\nline7\n'
    const newText = 'line1\nline2\nline3\nchanged\nline5\nline6\nline7\n'
    const hunks = buildLineDiffHunks(oldText, newText)
    expect(hunks).toHaveLength(1)
    const removes = hunks[0]!.lines.filter((line) => line.kind === 'remove')
    const adds = hunks[0]!.lines.filter((line) => line.kind === 'add')
    expect(removes).toEqual([{ kind: 'remove', content: 'line4' }])
    expect(adds).toEqual([{ kind: 'add', content: 'changed' }])
    expect(hunks[0]!.lines.some((line) => line.kind === 'context')).toBe(true)
    expect(hunks[0]!.lines.length).toBeLessThan(14)
  })

  it('treats create as all additions', () => {
    const hunks = buildLineDiffHunks('', 'hello\nworld\n')
    expect(hunks).toHaveLength(1)
    expect(hunks[0]!.lines.every((line) => line.kind === 'add')).toBe(true)
    expect(hunks[0]!.lines).toHaveLength(2)
  })
})

describe('countDiffLines', () => {
  it('counts additions and deletions', () => {
    expect(
      countDiffLines([
        {
          oldStart: 1,
          newStart: 1,
          lines: [
            { kind: 'context', content: 'keep' },
            { kind: 'remove', content: 'old' },
            { kind: 'add', content: 'new' },
            { kind: 'add', content: 'extra' },
          ],
        },
      ]),
    ).toEqual({ additions: 2, deletions: 1 })
  })
})

describe('resolveFileDiffHunks', () => {
  it('recomputes from old and new content', () => {
    const diff: FileDiff = {
      path: 'a.ts',
      operation: 'update',
      oldContent: 'a\nb\nc\n',
      newContent: 'a\nB\nc\n',
      hunks: [
        {
          oldStart: 1,
          newStart: 1,
          lines: [
            { kind: 'remove', content: 'a' },
            { kind: 'remove', content: 'b' },
            { kind: 'remove', content: 'c' },
            { kind: 'add', content: 'a' },
            { kind: 'add', content: 'B' },
            { kind: 'add', content: 'c' },
          ],
        },
      ],
    }
    const hunks = resolveFileDiffHunks(diff)
    const removes = hunks.flatMap((hunk) =>
      hunk.lines.filter((line) => line.kind === 'remove'),
    )
    const adds = hunks.flatMap((hunk) =>
      hunk.lines.filter((line) => line.kind === 'add'),
    )
    expect(removes).toEqual([{ kind: 'remove', content: 'b' }])
    expect(adds).toEqual([{ kind: 'add', content: 'B' }])
  })

  it('keeps rename hunks as stored', () => {
    const diff: FileDiff = {
      path: 'old.ts',
      operation: 'rename',
      newContent: 'new.ts',
      hunks: [
        {
          oldStart: 1,
          newStart: 1,
          lines: [
            { kind: 'remove', content: 'old.ts' },
            { kind: 'add', content: 'new.ts' },
          ],
        },
      ],
    }
    expect(resolveFileDiffHunks(diff)).toEqual(diff.hunks)
  })
})

describe('formatToolRunLabel', () => {
  it('includes path by default', () => {
    expect(
      formatToolRunLabel(
        toolRun({
          name: 'edit_file',
          args: { path: 'content/posts/building-durable-chats.md' },
        }),
      ),
    ).toBe('Edited content/posts/building-durable-chats.md')
  })

  it('uses present tense while running', () => {
    expect(
      formatToolRunLabel(
        toolRun({
          name: 'edit_file',
          status: 'running',
          args: { path: 'src/a.ts' },
        }),
      ),
    ).toBe('Editing src/a.ts…')
  })

  it('labels create_plan as Writing plan while running', () => {
    expect(
      formatToolRunLabel(
        toolRun({
          name: 'create_plan',
          status: 'running',
        }),
      ),
    ).toBe('Writing plan…')
  })

  it('labels spawn_subagent as Starting while running', () => {
    expect(
      formatToolRunLabel(
        toolRun({
          name: 'spawn_subagent',
          status: 'running',
          args: { agentName: 'Reading auth' },
        }),
      ),
    ).toBe('Starting Reading auth…')
  })

  it('omits path when omitPathHint is set', () => {
    expect(
      formatToolRunLabel(
        toolRun({
          name: 'edit_file',
          args: { path: 'content/posts/building-durable-chats.md' },
        }),
        { omitPathHint: true },
      ),
    ).toBe('Edited')
  })

  it('keeps non-path hints when omitPathHint is set', () => {
    expect(
      formatToolRunLabel(
        toolRun({
          name: 'grep',
          args: { pattern: 'TODO' },
        }),
        { omitPathHint: true },
      ),
    ).toBe('Searched TODO')
  })

  it('does not append a failed suffix on error', () => {
    expect(
      formatToolRunLabel(
        toolRun({
          name: 'read_file',
          args: { path: 'missing.ts' },
          status: 'error',
        }),
      ),
    ).toBe('Read missing.ts')
  })

  it('labels browser_lock wait as Waiting for browser while running', () => {
    expect(
      formatToolRunLabel(
        toolRun({
          name: 'browser_lock',
          status: 'running',
          args: { action: 'lock', wait: true },
        }),
      ),
    ).toBe('Waiting for browser…')
  })

  it('labels granted and released browser_lock', () => {
    expect(
      formatToolRunLabel(
        toolRun({
          name: 'browser_lock',
          status: 'running',
          args: { action: 'lock' },
        }),
      ),
    ).toBe('Using browser…')
    expect(
      formatToolRunLabel(
        toolRun({
          name: 'browser_lock',
          args: { action: 'lock' },
          result: { locked: true },
        }),
      ),
    ).toBe('Locked browser')
    expect(
      formatToolRunLabel(
        toolRun({
          name: 'browser_lock',
          args: { action: 'unlock' },
          result: { locked: false },
        }),
      ),
    ).toBe('Released browser')
  })

  it('labels browser_navigate with the URL host', () => {
    expect(
      formatToolRunLabel(
        toolRun({
          name: 'browser_navigate',
          status: 'running',
          args: { url: 'https://example.com/docs' },
        }),
      ),
    ).toBe('Opening example.com…')
    expect(
      formatToolRunLabel(
        toolRun({
          name: 'browser_navigate',
          args: { url: 'https://example.com/docs' },
        }),
      ),
    ).toBe('Opened example.com')
  })

  it('labels browser snapshot and screenshot verbs', () => {
    expect(
      formatToolRunLabel(
        toolRun({
          name: 'browser_snapshot',
          status: 'running',
        }),
      ),
    ).toBe('Reading page…')
    expect(
      formatToolRunLabel(
        toolRun({
          name: 'browser_take_screenshot',
          status: 'running',
        }),
      ),
    ).toBe('Capturing screenshot…')
    expect(
      formatToolRunLabel(
        toolRun({
          name: 'browser_click',
          status: 'running',
        }),
      ),
    ).toBe('Clicking…')
  })
})

describe('filePathBasename', () => {
  it('returns the final path segment', () => {
    expect(filePathBasename('content/posts/building-durable-chats.md')).toBe(
      'building-durable-chats.md',
    )
  })
})
