import { tool } from 'ai'
import { z } from 'zod'
import { readTerminalOutput } from '@/services/harness/shell/run-command'
import withToolExamples from '@/services/harness/with-tool-examples'
const terminalOutput = () =>
  tool({
    description: withToolExamples(
      'Read stdout/stderr from a background agent shell by shell_id from run_terminal. Do not pass spawn_subagent ids; the harness resumes the parent when background subagents finish. Use block true to wait until the shell exits.',
      [
        { shell_id: 'shell_abc123', tail: 80 },
        { shell_id: 'shell_abc123', block: true },
      ],
    ),
    inputSchema: z.object({
      shell_id: z
        .string()
        .describe('Id returned by run_terminal when is_background is true (not a subagentId)'),
      block: z.boolean().optional().describe('Wait until the shell exits'),
      tail: z.number().optional().describe('Max trailing lines to return'),
    }),
    execute: async ({ shell_id, block, tail }) => readTerminalOutput(shell_id, block, tail),
  })

export default terminalOutput
