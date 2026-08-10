import {
  createAgentShell,
  getAgentShell,
  killAgentShell,
  tailShellOutput,
  waitForShellExit,
} from '@/services/harness/shell/registry'
import formatShellExitReason from '@/services/harness/shell/format-exit-reason'
import {
  detectSandboxRuntimeDenial,
  sandboxRuntimeDenialError,
} from '@/services/harness/shell/sandbox-denial'
import { hasSubagent } from '@/services/harness/subagent/registry'
import type { HarnessToolContext } from '@/types/harness/tool-context'

export const runTerminalCommand = async (
  ctx: HarnessToolContext,
  args: {
    command: string
    is_background?: boolean
    timeout_ms?: number
    description?: string
    sandboxed?: boolean
    allowNetwork?: boolean
  },
): Promise<Record<string, unknown>> => {
  if (ctx.signal?.aborted) {
    throw new Error('Command aborted')
  }

  const shell = await createAgentShell({
    chatId: ctx.chatId,
    projectRoot: ctx.projectRoot,
    command: args.command,
    sandboxed: args.sandboxed,
    allowNetwork: args.allowNetwork,
  })

  if (args.is_background) {
    return {
      shellId: shell.shellId,
      status: 'running',
      command: args.command,
      description: args.description ?? null,
    }
  }

  const timeoutMs = args.timeout_ms
  const waitResult = await waitForShellExit(shell.shellId, timeoutMs)
  const current = getAgentShell(shell.shellId)
  const stdout = current?.stdout ?? ''
  const stderr = current?.stderr ?? ''

  if (waitResult.timedOut) {
    await killAgentShell(shell.shellId)
    throw new Error(`Command timed out after ${timeoutMs}ms: ${args.command}`)
  }

  if (waitResult.exitCode !== 0) {
    const reason = formatShellExitReason(waitResult)
    const detail = stderr.trim() || stdout.trim() || reason
    const wasSandboxed = args.sandboxed !== false
    if (wasSandboxed) {
      const combined = `${stdout}\n${stderr}`
      const denial = detectSandboxRuntimeDenial(combined)
      if (denial) {
        throw sandboxRuntimeDenialError(denial, detail)
      }
    }
    throw new Error(`Command failed (${reason}): ${detail}`)
  }

  return {
    shellId: shell.shellId,
    command: args.command,
    stdout,
    stderr,
    exitCode: waitResult.exitCode,
    timedOut: false,
    description: args.description ?? null,
  }
}

export const readTerminalOutput = async (
  shellId: string,
  block?: boolean,
  tail?: number,
): Promise<Record<string, unknown>> => {
  if (hasSubagent(shellId)) {
    throw new Error(
      'That id is a subagent, not a shell. Do not poll subagents with terminal_output. End your turn; the harness resumes when background subagents finish.',
    )
  }

  const shell = getAgentShell(shellId)
  if (!shell) {
    throw new Error(`Shell not found: ${shellId}`)
  }

  if (block && shell.status === 'running') {
    await waitForShellExit(shellId)
  }

  const current = getAgentShell(shellId)
  if (!current) {
    throw new Error(`Shell not found: ${shellId}`)
  }

  const output = tailShellOutput(current, tail)

  return {
    shellId,
    status: current.status,
    stdout: output.stdout,
    stderr: output.stderr,
    exitCode: current.exitCode,
  }
}
