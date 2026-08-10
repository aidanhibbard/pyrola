import { tool } from 'ai'
import { z } from 'zod'
import gitRepoInfo from '@/services/git/git-repo-info'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const gitBranch = (ctx: HarnessToolContext) =>
  tool({
    description: 'Current git branch',
    inputSchema: z.object({}),
    execute: async () => gitRepoInfo(ctx.projectRoot),
  })

export default gitBranch
