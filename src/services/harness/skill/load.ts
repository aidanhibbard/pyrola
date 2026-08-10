import { tool } from 'ai'
import { z } from 'zod'
import { loadSkill } from '@/services/skills/skill-registry'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const loadSkillTool = (ctx: HarnessToolContext) =>
  tool({
    description: 'Load the full instructions for a skill by name',
    inputSchema: z.object({ name: z.string() }),
    execute: async ({ name }) => {
      const result = await loadSkill(name, ctx.projectRoot)
      if ('error' in result) {
        return result
      }
      return {
        name: result.name,
        skillDirectory: result.skillDirectory,
        content: result.content,
        truncated: result.truncated,
      }
    },
  })

export default loadSkillTool
