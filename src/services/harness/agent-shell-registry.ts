import { listen } from '@tauri-apps/api/event'
import { shellKillTracked, shellSpawnTracked } from '@/services/pyrola/pyrola-tauri'
import type { AgentShellRecord, AgentShellStatus } from '@/types/harness/agent-shell'
import type { HarnessEvent } from '@/types/harness/harness-event'

type ShellOutputPayload = {
  shellId: string
  stream: 'stdout' | 'stderr'
  data: string
}

type ShellExitPayload = {
  shellId: string
  exitCode: number
}

type EventEmitter = (event: HarnessEvent) => void

const MAX_BUFFER_CHARS = 500_000

const shells = new Map<string, AgentShellRecord>()
const chatShells = new Map<string, Set<string>>()
const exitWaiters = new Map<string, Array<(exitCode: number) => void>>()
const shellUnlisteners = new Map<string, Array<() => void>>()

let eventEmitter: EventEmitter | null = null

export const setAgentShellEventEmitter = (emitter: EventEmitter | null): void => {
  eventEmitter = emitter
}

const emitHarnessEvent = (event: HarnessEvent): void => {
  eventEmitter?.(event)
}

const setShellStatus = (shell: AgentShellRecord, status: AgentShellStatus, exitCode: number): void => {
  shell.status = status
  shell.exitCode = exitCode
}

const appendOutput = (shellId: string, stream: 'stdout' | 'stderr', data: string): void => {
  const shell = shells.get(shellId)
  if (!shell) {
    return
  }

  if (stream === 'stdout') {
    shell.stdout = (shell.stdout + data).slice(-MAX_BUFFER_CHARS)
  } else {
    shell.stderr = (shell.stderr + data).slice(-MAX_BUFFER_CHARS)
  }

  emitHarnessEvent({ type: 'terminal-output', shellId, stream, data })
}

const resolveExitWaiters = (shellId: string, exitCode: number): void => {
  const waiters = exitWaiters.get(shellId) ?? []
  exitWaiters.delete(shellId)
  for (const resolve of waiters) {
    resolve(exitCode)
  }
}

const cleanupShellListeners = (shellId: string): void => {
  const unlisteners = shellUnlisteners.get(shellId) ?? []
  for (const unlisten of unlisteners) {
    unlisten()
  }
  shellUnlisteners.delete(shellId)
}

const markShellComplete = (shellId: string, exitCode: number): void => {
  const shell = shells.get(shellId)
  if (!shell || shell.status !== 'running') {
    return
  }

  setShellStatus(shell, exitCode === 0 ? 'completed' : 'failed', exitCode)
  emitHarnessEvent({ type: 'shell-complete', shellId, exitCode })
  resolveExitWaiters(shellId, exitCode)
  cleanupShellListeners(shellId)
}

const registerShellListeners = async (shellId: string): Promise<void> => {
  const unlistenOutput = await listen<ShellOutputPayload>(`shell-output-${shellId}`, (event) => {
    appendOutput(shellId, event.payload.stream, event.payload.data)
  })

  const unlistenExit = await listen<ShellExitPayload>(`shell-exit-${shellId}`, (event) => {
    markShellComplete(shellId, event.payload.exitCode)
  })

  shellUnlisteners.set(shellId, [unlistenOutput, unlistenExit])
}

const trackShellForChat = (chatId: string, shellId: string): void => {
  const existing = chatShells.get(chatId) ?? new Set<string>()
  existing.add(shellId)
  chatShells.set(chatId, existing)
}

export const createAgentShell = async (args: {
  chatId: string
  projectRoot: string
  command: string
}): Promise<AgentShellRecord> => {
  const shellId = crypto.randomUUID()
  const record: AgentShellRecord = {
    shellId,
    chatId: args.chatId,
    projectRoot: args.projectRoot,
    command: args.command,
    status: 'running',
    stdout: '',
    stderr: '',
    exitCode: null,
    startedAt: new Date().toISOString(),
  }

  shells.set(shellId, record)
  trackShellForChat(args.chatId, shellId)
  await registerShellListeners(shellId)
  await shellSpawnTracked({
    shellId,
    projectRoot: args.projectRoot,
    command: args.command,
  })

  return record
}

export const waitForShellExit = (
  shellId: string,
  timeoutMs: number,
): Promise<{ exitCode: number; timedOut: boolean }> => {
  const shell = shells.get(shellId)
  if (!shell) {
    return Promise.reject(new Error(`Shell not found: ${shellId}`))
  }

  if (shell.status !== 'running') {
    return Promise.resolve({
      exitCode: shell.exitCode ?? -1,
      timedOut: false,
    })
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({
        exitCode: shell.exitCode ?? -1,
        timedOut: true,
      })
    }, timeoutMs)

    const onExit = (exitCode: number): void => {
      clearTimeout(timer)
      resolve({ exitCode, timedOut: false })
    }

    const waiters = exitWaiters.get(shellId) ?? []
    waiters.push(onExit)
    exitWaiters.set(shellId, waiters)
  })
}

export const getAgentShell = (shellId: string): AgentShellRecord | null => shells.get(shellId) ?? null

export const tailShellOutput = (
  shell: AgentShellRecord,
  tail?: number,
): { stdout: string; stderr: string } => {
  if (!tail || tail <= 0) {
    return { stdout: shell.stdout, stderr: shell.stderr }
  }

  const tailText = (text: string): string => text.split('\n').slice(-tail).join('\n')

  return {
    stdout: tailText(shell.stdout),
    stderr: tailText(shell.stderr),
  }
}

export const killAgentShell = async (shellId: string): Promise<AgentShellRecord> => {
  const shell = shells.get(shellId)
  if (!shell) {
    throw new Error(`Shell not found: ${shellId}`)
  }

  if (shell.status === 'running') {
    const exitCode = await shellKillTracked(shellId)
    markShellComplete(shellId, exitCode)
  }

  return shell
}

export const killShellsForChat = async (chatId: string): Promise<void> => {
  const shellIds = chatShells.get(chatId)
  if (!shellIds) {
    return
  }

  const toKill = [...shellIds]
  for (const shellId of toKill) {
    try {
      await killAgentShell(shellId)
    } catch {
      shells.delete(shellId)
      cleanupShellListeners(shellId)
    }
  }

  chatShells.delete(chatId)
}

export const resetAgentShellRegistryForTests = (): void => {
  for (const shellId of shellUnlisteners.keys()) {
    cleanupShellListeners(shellId)
  }
  shells.clear()
  chatShells.clear()
  exitWaiters.clear()
  eventEmitter = null
}
