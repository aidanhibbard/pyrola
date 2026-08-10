import { tool } from 'ai'
import { z } from 'zod'
import { workspaceGrep } from '@/services/pyrola/pyrola-tauri'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const grep = (ctx: HarnessToolContext) =>
  tool({
    description: 'Search workspace with ripgrep',
    inputSchema: z.object({
      pattern: z.string(),
      glob: z.string().optional(),
    }),
    execute: async ({ pattern, glob }) =>
      workspaceGrep({ projectRoot: ctx.projectRoot, pattern, glob }),
  })

export default grep
