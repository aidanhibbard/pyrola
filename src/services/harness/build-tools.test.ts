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

const createAgentShell = vi.fn<
  (args: { chatId: string; projectRoot: string; command: string }) => Promise<{
    shellId: string
    status: string
    stdout: string
    stderr: string
    exitCode: number | null
    chatId: string
    projectRoot: string
    command: string
    startedAt: string
  }>
>()
const getAgentShell = vi.fn<(shellId: string) => unknown>()
const killAgentShell = vi.fn<(shellId: string) => Promise<unknown>>()
const waitForShellExit = vi.fn<
  (shellId: string, timeoutMs: number) => Promise<{ exitCode: number; timedOut: boolean }>
>()
const tailShellOutput = vi.fn<
  (shell: { stdout: string; stderr: string }, tail?: number) => { stdout: string; stderr: string }
>()

vi.mock('@/services/harness/agent-shell-registry', () => ({
  createAgentShell,
  getAgentShell,
  killAgentShell,
  tailShellOutput,
  waitForShellExit,
  killShellsForChat: vi.fn<() => Promise<void>>(),
  setAgentShellEventEmitter: vi.fn<(handler: unknown) => void>(),
}))

const openStudio = vi.fn<(projectId: string, slug: string, path: string, label?: string) => void>()
const resolveProjectIdByRoot = vi.fn<(root: string) => string | null>(() => 'project-1')

vi.mock('@/composables/use-workbench-store', () => ({
  default: () => ({
    openStudio,
    resolveProjectIdByRoot,
    refreshPlanStudioTabs: vi.fn<() => void>(),
  }),
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
    projectSlug: 'project',
    chatId: 'chat-1',
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

describe('build-tools run_terminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createAgentShell.mockResolvedValue({
      shellId: 'shell-1',
      status: 'running',
      stdout: '',
      stderr: '',
      exitCode: null,
      chatId: 'chat-1',
      projectRoot: '/project',
      command: 'echo hello',
      startedAt: new Date().toISOString(),
    })
    waitForShellExit.mockResolvedValue({ exitCode: 0, timedOut: false })
    getAgentShell.mockReturnValue({
      shellId: 'shell-1',
      status: 'completed',
      stdout: 'hello\n',
      stderr: '',
      exitCode: 0,
    })
    killAgentShell.mockResolvedValue({
      shellId: 'shell-1',
      exitCode: 0,
    })
    tailShellOutput.mockImplementation((shell, tail) => ({
      stdout: tail ? shell.stdout.split('\n').slice(-tail).join('\n') : shell.stdout,
      stderr: tail ? shell.stderr.split('\n').slice(-tail).join('\n') : shell.stderr,
    }))
  })

  const ctx = {
    projectRoot: '/project',
    projectSlug: 'project',
    chatId: 'chat-1',
    settings: { version: 1 } as PyrolaSettings,
    onPendingApproval: vi.fn<(toolCallId: string, name: string, diff: FileDiff[]) => void>(),
  }

  const runTool = async (
    execute: unknown,
    input: Record<string, unknown>,
    toolCallId = 'tc-shell',
  ): Promise<unknown> => {
    const runner = execute as (
      value: Record<string, unknown>,
      options: { toolCallId: string },
    ) => Promise<unknown>
    return runner(input, { toolCallId })
  }

  it('runs blocking commands and returns stdout', async () => {
    const buildTools = (await import('@/services/harness/build-tools')).default
    const tools = buildTools(ctx)
    const result = await runTool(tools.run_terminal.execute, { command: 'echo hello' })

    expect(createAgentShell).toHaveBeenCalledWith({
      chatId: 'chat-1',
      projectRoot: '/project',
      command: 'echo hello',
    })
    expect(waitForShellExit).toHaveBeenCalledWith('shell-1', 120_000)
    expect(result).toMatchObject({
      shellId: 'shell-1',
      stdout: 'hello\n',
      exitCode: 0,
      timedOut: false,
    })
  })

  it('returns immediately for background commands', async () => {
    const buildTools = (await import('@/services/harness/build-tools')).default
    const tools = buildTools(ctx)
    const result = await runTool(tools.run_terminal.execute, {
      command: 'npm run dev',
      is_background: true,
    })

    expect(waitForShellExit).not.toHaveBeenCalled()
    expect(result).toEqual({
      shellId: 'shell-1',
      status: 'running',
      command: 'npm run dev',
      description: null,
    })
  })

  it('reads terminal output for a shell id', async () => {
    getAgentShell.mockReturnValue({
      shellId: 'shell-1',
      status: 'running',
      stdout: 'log line\n',
      stderr: '',
      exitCode: null,
    })

    const buildTools = (await import('@/services/harness/build-tools')).default
    const tools = buildTools(ctx)
    const result = await runTool(tools.terminal_output.execute, { shell_id: 'shell-1', tail: 1 })

    expect(tailShellOutput).toHaveBeenCalled()
    expect(result).toMatchObject({
      shellId: 'shell-1',
      status: 'running',
    })
  })

  it('stops a background shell', async () => {
    const buildTools = (await import('@/services/harness/build-tools')).default
    const tools = buildTools(ctx)
    const result = await runTool(tools.stop_terminal.execute, { shell_id: 'shell-1' })

    expect(killAgentShell).toHaveBeenCalledWith('shell-1')
    expect(result).toEqual({ shellId: 'shell-1', exitCode: 0 })
  })
})

describe('build-tools write_studio_artifact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fsWriteFile.mockResolvedValue(sampleDiff)
    openStudio.mockReset()
    resolveProjectIdByRoot.mockReturnValue('project-1')
  })

  const ctx = {
    projectRoot: '/project',
    projectSlug: 'project',
    chatId: 'chat-1',
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

  it('writes index.md and optional data.json', async () => {
    const buildTools = (await import('@/services/harness/build-tools')).default
    const tools = buildTools(ctx)
    const content = `---
title: Brief
---

## Hello
`
    await runTool(
      tools.write_studio_artifact.execute,
      { slug: 'launch-brief', content, data: { metrics: [1, 2] } },
      'tc-studio-1',
    )

    expect(fsWriteFile).toHaveBeenCalledWith({
      projectRoot: '/project',
      path: '.pyrola/studio/launch-brief/index.md',
      content,
    })
    expect(fsWriteFile).toHaveBeenCalledWith({
      projectRoot: '/project',
      path: '.pyrola/studio/launch-brief/data.json',
      content: `${JSON.stringify({ metrics: [1, 2] }, null, 2)}\n`,
    })
    expect(openStudio).toHaveBeenCalled()
  })

  it('rejects HTML content', async () => {
    const buildTools = (await import('@/services/harness/build-tools')).default
    const tools = buildTools(ctx)
    const result = await runTool(
      tools.write_studio_artifact.execute,
      { slug: 'bad', content: '<html><body>x</body></html>' },
      'tc-studio-2',
    )

    expect(result).toMatchObject({ error: expect.stringContaining('HTML') })
    expect(fsWriteFile).not.toHaveBeenCalled()
  })

  it('rejects invalid slugs', async () => {
    const buildTools = (await import('@/services/harness/build-tools')).default
    const tools = buildTools(ctx)
    const result = await runTool(
      tools.write_studio_artifact.execute,
      { slug: '../escape', content: '# Hello' },
      'tc-studio-3',
    )

    expect(result).toMatchObject({ error: expect.stringMatching(/slug/i) })
    expect(fsWriteFile).not.toHaveBeenCalled()
  })
})
