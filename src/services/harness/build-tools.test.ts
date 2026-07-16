import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'

const fsStagePreviewWrite = vi.fn()
const fsStagePreviewEdit = vi.fn()
const fsStagePreviewApplyPatch = vi.fn()
const fsWriteFile = vi.fn()
const fsEditFile = vi.fn()
const fsApplyPatch = vi.fn()
const requestApproval = vi.fn()

vi.mock('@/services/pyrola/pyrola-tauri', () => ({
  fsReadFile: vi.fn(),
  fsListDir: vi.fn(),
  fsWriteFile,
  fsEditFile,
  fsApplyPatch,
  fsStagePreviewWrite,
  fsStagePreviewEdit,
  fsStagePreviewApplyPatch,
  workspaceGrep: vi.fn(),
  workspaceGlob: vi.fn(),
  gitStatus: vi.fn(),
  gitDiff: vi.fn(),
  gitLog: vi.fn(),
  lspEnsureServer: vi.fn(),
  lspRequest: vi.fn(),
  mcpCallTool: vi.fn(),
  shellRunCommand: vi.fn(),
  httpProxyRequest: vi.fn(),
}))

vi.mock('@/services/git/git-repo-info', () => ({
  default: vi.fn(),
}))

vi.mock('@/services/harness/approval-gate', () => ({
  requestApproval,
  shouldAutoApprove: vi.fn(() => true),
}))

const sampleDiff = {
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
    onPendingApproval: vi.fn(),
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
