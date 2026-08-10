import { tool } from 'ai'
import { z } from 'zod'
import callManagedCodegraphTool from '@/services/harness/codebase/call-managed'
import normalizeCodegraphResult from '@/services/codegraph/normalize-codegraph-result'
import type { HarnessToolContext } from '@/types/harness/tool-context'

const codebaseStatus = (ctx: HarnessToolContext) =>
  tool({
    description:
      'Check CodeGraph index health (ready, pending sync, errors). Use when the index may be missing or stale.',
    inputSchema: z.object({}),
    execute: async (input, { toolCallId }) => {
      const called = await callManagedCodegraphTool(ctx, {
        toolCallId,
        firstPartyName: 'codebase_status',
        mcpToolName: 'codegraph_status',
        toolArgs: input,
      })
      if (!called.ok) {
        if ('rejected' in called.payload) {
          return called.payload
        }
        return {
          ready: false,
          indexing: false,
          syncing: false,
          error:
            typeof called.payload.error === 'string'
              ? called.payload.error
              : 'CodeGraph status failed',
        }
      }
      return normalizeCodegraphResult.status(called.result)
    },
  })

export default codebaseStatus
