import { describe, expect, it } from 'vitest'
import type { ToolRun } from '@/types/harness/tool-run'
import summarizeStepTools from '@/utils/summarize-step-tools'

const tool = (name: string, status: ToolRun['status'] = 'done'): ToolRun => ({
  toolCallId: crypto.randomUUID(),
  name,
  status,
})

describe('summarizeStepTools', () => {
  it('returns Working… when tools are still running', () => {
    expect(summarizeStepTools([tool('list_dir', 'running')])).toBe('Working…')
  })

  it('returns a single tool label for one completed tool', () => {
    expect(summarizeStepTools([tool('list_dir')])).toBe('Listed')
  })

  it('summarizes multiple tools by category', () => {
    const summary = summarizeStepTools([
      tool('read_file'),
      tool('read_file'),
      tool('glob_files'),
      tool('git_log'),
    ])
    expect(summary).toBe('Explored 2 files, 1 search, 1 git check')
  })
})
