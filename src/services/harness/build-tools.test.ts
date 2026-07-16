import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import type { FileDiff } from '@/types/harness/file-diff'

const fsStagePreviewWrite = vi.fn<
  (args: { projectRoot: string; path: string; content: string }) => Promise<FileDiff[]>
>()
const fsStagePreviewEdit = vi.fn<
  (args: {
    projectRoot: string
    path: string
    replacements: Array<{ oldString: string; newString: string }>
  }) => Promise<FileDiff[]>
>()
const fsStagePreviewApplyPatch = vi.fn<
  (args: { projectRoot: string; patch: string }) => Promise<FileDiff[]>
>()
const fsWriteFile = vi.fn<
  (args: { projectRoot: string; path: string; content: string }) => Promise<FileDiff>
>()
const fsEditFile = vi.fn<
  (args: {
    projectRoot: string
    path: string
    replacements: Array<{ oldString: string; newString: string }>
  }) => Promise<FileDiff>
>()
const fsApplyPatch = vi.fn<
  (args: { projectRoot: string; patch: string }) => Promise<FileDiff[]>
>()
const requestApproval = vi.fn<
  (toolCallId: string, name: string, diff: FileDiff[]) => Promise<boolean>
>()

vi.mock('@/services/pyrola/pyrola-tauri', () => ({
  fsReadFile: vi.fn<() => Promise<string>>(),
  fsListDir: vi.fn<() => Promise<unknown>>(),
  fsWriteFile,
  fsEditFile,
  fsApplyPatch,
  fsStagePreviewWrite,
  fsStagePreviewEdit,
  fsStagePreviewApplyPatch,
  workspaceGrep: vi.fn<() => Promise<unknown>>(),
  workspaceGlob: vi.fn<() => Promise<unknown>>(),
  gitStatus: vi.fn<() => Promise<unknown>>(),
  gitDiff: vi.fn<() => Promise<unknown>>(),
  gitLog: vi.fn<() => Promise<unknown>>(),
  lspEnsureServer: vi.fn<() => Promise<unknown>>(),
  lspRequest: vi.fn<() => Promise<unknown>>(),
  mcpCallTool: vi.fn<() => Promise<unknown>>(),
  shellRunCommand: vi.fn<() => Promise<unknown>>(),
  httpProxyRequest: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('@/services/git/git-repo-info', () => ({
  default: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('@/services/harness/approval-gate', () => ({
  requestApproval,
  shouldAutoApprove: vi.fn<() => boolean>(() => true),
}))

const sampleDiff: FileDiff = {
  path: 'src/main.ts',
  operation: 'update',
  hunks: [],
}

describe('build-tools stage preview wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fsStagePreviewWrite.mockResolvedValue([sampleDiff])
    fsStagePreviewEdit.mockResolvedValue([sampleDiff])
    fsStagePreviewApplyPatch.mockResolvedValue([sampleDiff])
    fsWriteFile.mockResolvedValue(sampleDiff)
    fsEditFile.mockResolvedValue(sampleDiff)
    fsApplyPatch.mockResolvedValue([sampleDiff])
    requestApproval.mockResolvedValue(true)
  })

  const ctx = {
    projectRoot: '/project',
    settings: { version: 1 } as PyrolaSettings,
    onPendingApproval: vi.fn<(toolCallId: string, name: string, diff: FileDiff[]) => void>(),
  }

  const runTool = async (
    execute: unknown,
    input: Record<string, unknown>,
    toolCallId: string,
  ): Promise<unknown> => {
    const runner = execute as (
      value: Record<string, unknown>,
      options: { toolCallId: string },
    ) => Promise<unknown>
    return runner(input, { toolCallId })
  }

  it('write_file stages preview with tagged write request', async () => {
    const buildTools = (await import('@/services/harness/build-tools')).default
    const tools = buildTools(ctx)
    await runTool(tools.write_file.execute, { path: 'src/main.ts', content: 'next' }, 'tc-1')

    expect(fsStagePreviewWrite).toHaveBeenCalledWith({
      projectRoot: '/project',
      path: 'src/main.ts',
      content: 'next',
    })
    expect(fsWriteFile).toHaveBeenCalledWith({
      projectRoot: '/project',
      path: 'src/main.ts',
      content: 'next',
    })
  })

  it('edit_file stages preview with replacements', async () => {
    const buildTools = (await import('@/services/harness/build-tools')).default
    const tools = buildTools(ctx)
    await runTool(
      tools.edit_file.execute,
      { path: 'src/main.ts', old_string: 'old', new_string: 'new' },
      'tc-2',
    )

    expect(fsStagePreviewEdit).toHaveBeenCalledWith({
      projectRoot: '/project',
      path: 'src/main.ts',
      replacements: [{ oldString: 'old', newString: 'new' }],
    })
    expect(fsEditFile).toHaveBeenCalledWith({
      projectRoot: '/project',
      path: 'src/main.ts',
      replacements: [{ oldString: 'old', newString: 'new' }],
    })
  })

  it('apply_patch stages preview before applying', async () => {
    const buildTools = (await import('@/services/harness/build-tools')).default
    const tools = buildTools(ctx)
    const patch = '*** Update File: src/main.ts\n@@\n-old\n+new'
    await runTool(tools.apply_patch.execute, { patch }, 'tc-3')

    expect(fsStagePreviewApplyPatch).toHaveBeenCalledWith({
      projectRoot: '/project',
      patch,
    })
    expect(fsApplyPatch).toHaveBeenCalledWith({
      projectRoot: '/project',
      patch,
    })
  })
})
