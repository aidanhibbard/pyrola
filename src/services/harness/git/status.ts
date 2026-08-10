import { tool } from 'ai'
import { z } from 'zod'
import { gitStatus as gitStatusCommand } from '@/services/pyrola/pyrola-tauri'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const gitStatus = (ctx: HarnessToolContext) =>
  tool({
    description: 'Git status',
    inputSchema: z.object({}),
    execute: async () => gitStatusCommand(ctx.projectRoot),
  })

export default gitStatus
