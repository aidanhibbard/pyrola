import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentShellRecord } from '@/types/harness/agent-shell'

const shellSpawnTracked = vi.fn<() => Promise<void>>()
const shellKillTracked = vi.fn<() => Promise<number>>()

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn<() => Promise<() => void>>(async () => () => {}),
}))

vi.mock('@/services/pyrola/pyrola-tauri', () => ({
  shellSpawnTracked,
  shellKillTracked,
}))

describe('agent-shell-registry', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    shellSpawnTracked.mockResolvedValue(undefined)
    shellKillTracked.mockResolvedValue(0)
    const { resetAgentShellRegistryForTests } = await import(
      '@/services/harness/agent-shell-registry'
    )
    resetAgentShellRegistryForTests()
  })

  it('creates a background shell and tracks it by chat', async () => {
    const { createAgentShell, getAgentShell } = await import(
      '@/services/harness/agent-shell-registry'
    )

    const shell = await createAgentShell({
      chatId: 'chat-1',
      projectRoot: '/project',
      command: 'npm run dev',
    })

    expect(shell.status).toBe('running')
    expect(shellSpawnTracked).toHaveBeenCalledWith({
      shellId: shell.shellId,
      projectRoot: '/project',
      command: 'npm run dev',
    })
    expect(getAgentShell(shell.shellId)?.chatId).toBe('chat-1')
  })

  it('tails shell output to the last N lines', async () => {
    const { tailShellOutput } = await import('@/services/harness/agent-shell-registry')

    const shell: AgentShellRecord = {
      shellId: 'shell-1',
      chatId: 'chat-1',
      projectRoot: '/project',
      command: 'echo',
      status: 'running',
      stdout: 'line-1\nline-2\nline-3',
      stderr: 'err-1\nerr-2',
      exitCode: null,
      startedAt: new Date().toISOString(),
    }

    const output = tailShellOutput(shell, 2)

    expect(output.stdout).toBe('line-2\nline-3')
    expect(output.stderr).toBe('err-1\nerr-2')
  })

  it('kills all shells for a chat', async () => {
    const { createAgentShell, killShellsForChat, getAgentShell } = await import(
      '@/services/harness/agent-shell-registry'
    )

    const first = await createAgentShell({
      chatId: 'chat-1',
      projectRoot: '/project',
      command: 'sleep 10',
    })
    const second = await createAgentShell({
      chatId: 'chat-1',
      projectRoot: '/project',
      command: 'sleep 20',
    })

    await killShellsForChat('chat-1')

    expect(shellKillTracked).toHaveBeenCalledTimes(2)
    expect(shellKillTracked).toHaveBeenCalledWith(first.shellId)
    expect(shellKillTracked).toHaveBeenCalledWith(second.shellId)
    expect(getAgentShell(first.shellId)?.status).toBe('completed')
    expect(getAgentShell(second.shellId)?.status).toBe('completed')
  })
})
