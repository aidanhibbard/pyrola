import { tool } from 'ai'
import { z } from 'zod'
import { gateToolPermission } from '@/services/harness/permission/gate'
import { isSandboxSpawnError } from '@/services/harness/shell/sandbox-denial'
import { runTerminalCommand } from '@/services/harness/shell/run-command'
import withToolExamples from '@/services/harness/with-tool-examples'
import toPermCtx from '@/services/harness/shared/to-perm-ctx'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const runTerminal = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Run a shell command on the user machine (project cwd). Use for system reports, profiling, benchmarks, process/memory inspection, dev servers, and local agent monitoring, not only repo tasks. Default is blocking until exit. For long-running sampling (memory over a minute, log tailing, npm run dev), set is_background to true and poll with terminal_output. Append | cat for pagers. Do not use for file edits.',
      [
        {
          command: 'git status --short',
          description: 'Working tree status',
        },
        {
          command: 'npm run dev',
          is_background: true,
          description: 'Start Vite dev server',
        },
      ],
    ),
    inputSchema: z.object({
      command: z.string().describe('Shell command to run in the project cwd'),
      is_background: z
        .boolean()
        .optional()
        .describe('If true, return shell_id and poll with terminal_output'),
      timeout_ms: z.number().optional().describe('Optional max wait for blocking runs'),
      description: z.string().optional().describe('Short label for the UI'),
    }),
    execute: async ({ command, is_background, timeout_ms, description }, { toolCallId }) => {
      const sandboxEnabled = ctx.settings['agent.sandbox.enabled'] ?? true
      const allowNetwork = (ctx.settings['agent.sandbox.network'] ?? 'deny') === 'allow'
      const allowed = await gateToolPermission({
        ctx: toPermCtx(ctx),
        toolCallId,
        name: 'run_terminal',
        kind: 'shell',
        action: sandboxEnabled ? 'shell' : 'shell.unsandboxed',
        capability: sandboxEnabled ? 'shell' : 'shell.unsandboxed',
        title: command,
        unsandboxed: !sandboxEnabled,
      })
      if (!allowed) {
        return { rejected: true, error: 'Shell access denied' }
      }

      try {
        return await runTerminalCommand(ctx, {
          command,
          is_background,
          timeout_ms,
          description,
          sandboxed: sandboxEnabled,
          allowNetwork,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)

        if (sandboxEnabled && isSandboxSpawnError(message)) {
          const unsandboxedAllowed = await gateToolPermission({
            ctx: toPermCtx(ctx),
            toolCallId,
            name: 'run_terminal',
            kind: 'shell',
            action: 'shell.unsandboxed',
            capability: 'shell.unsandboxed',
            title: command,
            detail: `Sandbox blocked this command. Approve to retry without sandbox.\n\n${message}`,
            unsandboxed: true,
          })

          if (!unsandboxedAllowed) {
            return { rejected: true, error: `Sandbox blocked: ${message}` }
          }

          return runTerminalCommand(ctx, {
            command,
            is_background,
            timeout_ms,
            description,
            sandboxed: false,
          })
        }

        throw error
      }
    },
  })

export default runTerminal
