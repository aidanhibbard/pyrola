import { tool } from 'ai'
import { z } from 'zod'
import callManagedCodegraphTool from '@/services/harness/codebase/call-managed'
import normalizeCodegraphResult from '@/services/codegraph/normalize-codegraph-result'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const codebaseExplore = (ctx: HarnessToolContext) =>
  tool({
    description:
      'Explore the CodeGraph index for architecture, flows, and "where is X" questions. Prefer over grep/read loops for structural context. Returns normalized spans with path and line ranges when possible.',
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'Natural-language question or bag of symbol/file names (for example "AuthService loginUser" or "how does MCP trust work")',
        ),
    }),
    execute: async ({ query }, { toolCallId }) => {
      const called = await callManagedCodegraphTool(ctx, {
        toolCallId,
        firstPartyName: 'codebase_explore',
        mcpToolName: 'codegraph_explore',
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
              : 'CodeGraph explore failed',
          results: [],
        }
      }
      return normalizeCodegraphResult.tool(called.result)
    },
  })

export default codebaseExplore
