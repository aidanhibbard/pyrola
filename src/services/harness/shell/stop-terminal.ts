import { tool } from 'ai'
import { z } from 'zod'
import { killAgentShell } from '@/services/harness/shell/registry'
const stopTerminal = () =>
  tool({
    description: 'Stop a background agent shell by shell_id.',
    inputSchema: z.object({
      shell_id: z.string(),
    }),
    execute: async ({ shell_id }) => {
      const shell = await killAgentShell(shell_id)
      return {
        shellId: shell.shellId,
        exitCode: shell.exitCode,
      }
    },
  })

export default stopTerminal
