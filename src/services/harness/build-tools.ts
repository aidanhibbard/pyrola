import buildHarnessTools from '@/services/harness/build-harness-tools'
import { spawnSubagent, SUBAGENT_MCP_TOOLS } from '@/services/harness/subagent'
import type { HarnessToolContext } from '@/types/harness/tool-context'

export type { HarnessToolContext } from '@/types/harness/tool-context'
export { SUBAGENT_MCP_TOOLS }

const buildTools = (ctx: HarnessToolContext) => ({
  ...buildHarnessTools(ctx),
  spawn_subagent: spawnSubagent(ctx),
})

export default buildTools
