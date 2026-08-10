import { tool } from 'ai'
import { z } from 'zod'
import callManagedCodegraphTool from '@/services/harness/codebase/call-managed'
import normalizeCodegraphResult from '@/services/codegraph/normalize-codegraph-result'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const codebaseSearch = (ctx: HarnessToolContext) =>
  tool({
    description:
      'Search the CodeGraph index for symbols by name. Returns locations only. Prefer codebase_explore when you need source context.',
    inputSchema: z.object({
      query: z.string().describe('Symbol name or partial name to search'),
    }),
    execute: async ({ query }, { toolCallId }) => {
      const called = await callManagedCodegraphTool(ctx, {
        toolCallId,
        firstPartyName: 'codebase_search',
        mcpToolName: 'codegraph_search',
        toolArgs: { query },
      })
      if (!called.ok) {
        if ('rejected' in called.payload) {
          return called.payload
        }
        return {
          summary:
            typeof called.payload.error === 'string'
              ? called.payload.error
              : 'CodeGraph search failed',
          results: [],
        }
      }
      return normalizeCodegraphResult.tool(called.result)
    },
  })

export default codebaseSearch
