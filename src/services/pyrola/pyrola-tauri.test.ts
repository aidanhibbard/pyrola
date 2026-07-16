import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn<(command: string, args?: Record<string, unknown>) => Promise<unknown>>()

vi.mock('@tauri-apps/api/core', () => ({
  invoke,
}))

const setTauriWindow = (): void => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    value: {},
    configurable: true,
  })
}

describe('pyrola-tauri IPC adapters', () => {
  beforeEach(() => {
    invoke.mockReset()
    setTauriWindow()
  })

  it('wraps workspace_glob request and returns result', async () => {
    invoke.mockResolvedValueOnce({
      files: [{ path: 'src/main.ts', modifiedMs: 1 }],
      truncated: false,
    })

    const { workspaceGlob } = await import('@/services/pyrola/pyrola-tauri')
    const result = await workspaceGlob('/project', '**/*.ts')

    expect(invoke).toHaveBeenCalledWith('workspace_glob', {
      request: { projectRoot: '/project', pattern: '**/*.ts', limit: undefined },
    })
    expect(result.files).toHaveLength(1)
  })

  it('wraps workspace_grep request and returns result', async () => {
    invoke.mockResolvedValueOnce({
      matches: [{ path: 'src/main.ts', lineNumber: 1, line: 'import' }],
      truncated: false,
    })

    const { workspaceGrep } = await import('@/services/pyrola/pyrola-tauri')
    const result = await workspaceGrep({
      projectRoot: '/project',
      pattern: 'import',
      glob: '*.ts',
    })

    expect(invoke).toHaveBeenCalledWith('workspace_grep', {
      request: {
        projectRoot: '/project',
        pattern: 'import',
        glob: '*.ts',
      },
    })
    expect(result.matches).toHaveLength(1)
  })

  it('passes tagged write request to fs_stage_preview', async () => {
    invoke.mockResolvedValueOnce([])

    const { fsStagePreviewWrite } = await import('@/services/pyrola/pyrola-tauri')
    await fsStagePreviewWrite({
      projectRoot: '/project',
      path: 'src/main.ts',
      content: 'const app = createApp(App)',
    })

    expect(invoke).toHaveBeenCalledWith('fs_stage_preview', {
      projectRoot: '/project',
      request: {
        kind: 'write',
        path: 'src/main.ts',
        content: 'const app = createApp(App)',
      },
    })
  })

  it('passes tagged edit request to fs_stage_preview', async () => {
    invoke.mockResolvedValueOnce([])

    const { fsStagePreviewEdit } = await import('@/services/pyrola/pyrola-tauri')
    await fsStagePreviewEdit({
      projectRoot: '/project',
      path: 'src/main.ts',
      replacements: [{ oldString: 'old', newString: 'new' }],
    })

    expect(invoke).toHaveBeenCalledWith('fs_stage_preview', {
      projectRoot: '/project',
      request: {
        kind: 'edit',
        path: 'src/main.ts',
        replacements: [{ oldString: 'old', newString: 'new' }],
      },
    })
  })

  it('passes replacements array to fs_edit_file', async () => {
    invoke.mockResolvedValueOnce({ path: 'src/main.ts', operation: 'update', hunks: [] })

    const { fsEditFile } = await import('@/services/pyrola/pyrola-tauri')
    await fsEditFile({
      projectRoot: '/project',
      path: 'src/main.ts',
      replacements: [{ oldString: 'old', newString: 'new' }],
    })

    expect(invoke).toHaveBeenCalledWith('fs_edit_file', {
      projectRoot: '/project',
      path: 'src/main.ts',
      replacements: [{ oldString: 'old', newString: 'new' }],
    })
  })

  it('passes shell_run_command args', async () => {
    invoke.mockResolvedValueOnce({
      stdout: 'ok',
      stderr: '',
      exitCode: 0,
      timedOut: false,
    })

    const { shellRunCommand } = await import('@/services/pyrola/pyrola-tauri')
    await shellRunCommand({
      projectRoot: '/project',
      command: 'echo ok',
      timeoutMs: 5000,
    })

    expect(invoke).toHaveBeenCalledWith('shell_run_command', {
      projectRoot: '/project',
      command: 'echo ok',
      timeoutMs: 5000,
    })
  })
})
