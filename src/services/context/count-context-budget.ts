import type { UIMessage } from 'ai'
import { getContext } from 'tokenlens'
import type { PyrolaChatMode, PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import type { ContextMention } from '@/types/harness/context-mention'
import type { ContextBudget } from '@/types/harness/context-budget'
import type { ContextBucket, ContextBucketId } from '@/types/harness/context-bucket'
import { CONTEXT_BUCKET_META, CONTEXT_BUCKET_ORDER } from '@/types/harness/context-bucket-meta'
import { MODE_TOOL_ALLOWLIST } from '@/services/harness/mode-allowlists'
import { TOOL_DESCRIPTIONS } from '@/services/harness/tool-catalog'
import estimateTextTokens from '@/utils/estimate-text-tokens'
import assembleSystemPromptParts, {
  type SystemPromptParts,
} from '@/services/context/system-prompt-parts'
import { migrateMcpConfig, isMcpServerEnabled } from '@/schemas/mcp-config'
import { listEffectiveMcpServers } from '@/services/mcp/merge-mcp-config'
import { mcpListStatuses, readMcpConfig } from '@/services/pyrola/pyrola-tauri'
import { resolveContextWindow } from '@/services/models/resolve-model-call-options'

export type CountContextBudgetInput = {
  modelId: string
  providerId?: string
  settings?: PyrolaSettings
  mode: PyrolaChatMode
  projectName: string
  projectRoot: string
  mentions: ContextMention[]
  messages: UIMessage[]
  agentCatalog?: Array<{ name: string; description: string }>
  standalone?: boolean
  parts?: SystemPromptParts
}

const DEFAULT_CONTEXT_LIMIT = 128_000
const TOOL_SCHEMA_TOKEN_OVERHEAD = 180

const resolveContextLimit = (
  modelId: string,
  providerId?: string,
  settings?: PyrolaSettings,
): number => {
  if (providerId && settings) {
    const override = resolveContextWindow(settings, { providerId, modelId })
    if (typeof override === 'number' && override > 0) {
      return override
    }
  }
  if (!modelId) {
    return DEFAULT_CONTEXT_LIMIT
  }
  try {
    const context = getContext({ modelId })
    return context.maxInput ?? context.maxTotal ?? DEFAULT_CONTEXT_LIMIT
  } catch {
    return DEFAULT_CONTEXT_LIMIT
  }
}

const serializeMessages = (messages: UIMessage[]): string =>
  messages
    .map((message) =>
      message.parts
        .map((part) => {
          if (part.type === 'text' || part.type === 'reasoning') {
            return part.text
          }
          return JSON.stringify(part)
        })
        .join('\n'),
    )
    .join('\n\n')

const estimateBuiltinToolSchemas = (mode: PyrolaChatMode): number =>
  MODE_TOOL_ALLOWLIST[mode].reduce((total, name) => {
    const description = TOOL_DESCRIPTIONS[name] ?? name
    return total + estimateTextTokens(description) + TOOL_SCHEMA_TOKEN_OVERHEAD
  }, 0)

const estimateMcpToolSchemas = async (
  projectRoot: string,
  standalone?: boolean,
): Promise<number> => {
  const personal = migrateMcpConfig(await readMcpConfig('personal', null))
  const project = standalone
    ? null
    : await readMcpConfig('project', projectRoot)
        .then((raw) => migrateMcpConfig(raw))
        .catch(() => null)
  const servers = listEffectiveMcpServers(personal, project).filter((server) =>
    isMcpServerEnabled(server.config),
  )

  let bulkStatuses: Awaited<ReturnType<typeof mcpListStatuses>> = {}
  try {
    bulkStatuses = await mcpListStatuses()
  } catch {
    return 0
  }

  let total = 0
  for (const server of servers) {
    const state = bulkStatuses[server.id]
    if (!state) {
      continue
    }
    for (const tool of state.tools) {
      const schema = tool.inputSchema ? JSON.stringify(tool.inputSchema) : ''
      total +=
        estimateTextTokens(tool.name) +
        estimateTextTokens(tool.description ?? '') +
        estimateTextTokens(schema) +
        TOOL_SCHEMA_TOKEN_OVERHEAD
    }
  }
  return total
}

const buildBucket = (id: ContextBucketId, tokens: number): ContextBucket => ({
  id,
  label: CONTEXT_BUCKET_META[id].label,
  tokens,
})

export default async (input: CountContextBudgetInput): Promise<ContextBudget> => {
  const parts =
    input.parts ??
    (await assembleSystemPromptParts({
      mode: input.mode,
      projectName: input.projectName,
      projectRoot: input.projectRoot,
      mentions: input.mentions,
      agentCatalog: input.agentCatalog ?? [],
      standalone: input.standalone,
    }))

  const builtinToolSchemas = estimateBuiltinToolSchemas(input.mode)
  const mcpToolSchemas = await estimateMcpToolSchemas(
    input.projectRoot,
    input.standalone,
  )

  const bucketTokens: Record<ContextBucketId, number> = {
    system: estimateTextTokens(parts.base),
    tools:
      estimateTextTokens(parts.tools) +
      estimateTextTokens(parts.mcp) +
      builtinToolSchemas +
      mcpToolSchemas,
    rules: estimateTextTokens(parts.rules),
    skills: estimateTextTokens(parts.skills),
    mentions: estimateTextTokens(parts.mentions),
    subagentDefinitions: estimateTextTokens(parts.subagents),
    messages: estimateTextTokens(serializeMessages(input.messages)),
  }

  const buckets = CONTEXT_BUCKET_ORDER.map((id) => buildBucket(id, bucketTokens[id]))
  const used = buckets.reduce((sum, bucket) => sum + bucket.tokens, 0)
  const limit = resolveContextLimit(input.modelId, input.providerId, input.settings)

  return {
    modelId: input.modelId,
    used,
    limit,
    buckets,
  }
}
