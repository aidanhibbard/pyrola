import { tool } from 'ai'
import { z } from 'zod'
import loadProviderModelsCatalog from '@/services/models/catalog-cache'
import { resolveCatalogMatches } from '@/services/models/search'
import withToolExamples from '@/services/harness/with-tool-examples'
import type { HarnessToolContext } from '@/types/harness/tool-context'
import type { ResolveCatalogMatchesResult } from '@/types/models/resolve-catalog-matches-result'

const resolveModels = (ctx: HarnessToolContext) =>
  tool({
    description: withToolExamples(
      'Look up a few allowed model refs by query and optional provider. Lookup only: never dump the catalog. Pass an exact match ref to spawn_subagent as model. Omit model on spawn to use the locked or settings default.',
      [{ query: 'sonnet' }, { query: 'gpt-4o', provider: 'openai' }],
    ),
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe('Model id or name fragment to search'),
      provider: z
        .string()
        .optional()
        .describe('Provider id or name to scope the search'),
    }),
    execute: async ({
      query,
      provider,
    }): Promise<ResolveCatalogMatchesResult> => {
      const groups = await loadProviderModelsCatalog(ctx.settings)
      return resolveCatalogMatches(groups, ctx.settings, { query, provider })
    },
  })

export default resolveModels
