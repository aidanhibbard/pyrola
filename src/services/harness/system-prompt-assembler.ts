import { listPyrolaFiles } from '@/services/pyrola/pyrola-tauri'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import type { ContextMention } from '@/types/harness/context-mention'
import gitRepoInfo from '@/services/git/git-repo-info'
import { formatToolCatalogForMode } from '@/services/harness/tool-catalog'
import { migrateMcpConfig } from '@/schemas/mcp-config'
import { listEffectiveMcpServers } from '@/services/mcp/merge-mcp-config'
import { mcpStatus, readMcpConfig } from '@/services/pyrola/pyrola-tauri'

export type SystemPromptInput = {
  mode: PyrolaChatMode
  projectName: string
  projectRoot: string
  mentions: ContextMention[]
  agentCatalog: Array<{ name: string; description: string }>
}

const formatMcpCatalog = async (projectRoot: string): Promise<string> => {
  const personal = migrateMcpConfig(await readMcpConfig('personal', null))
  const projectRaw = await readMcpConfig('project', projectRoot).catch(() => null)
  const project = projectRaw ? migrateMcpConfig(projectRaw) : null
  const servers = listEffectiveMcpServers(personal, project)

  if (servers.length === 0) {
    return 'No MCP servers are configured. Use get_mcp_tools after adding servers in Settings.'
  }

  const lines: string[] = []
  for (const server of servers) {
    try {
      const state = await mcpStatus(server.id)
      if (state.tools.length === 0) {
        lines.push(
          `- ${server.id} (${state.status}): no tools listed — start the server in Settings or call get_mcp_tools`,
        )
        continue
      }
      const toolLines = state.tools
        .map((tool) => `  - ${tool.name}${tool.description ? `: ${tool.description}` : ''}`)
        .join('\n')
      lines.push(`- ${server.id} (${state.status}):\n${toolLines}`)
    } catch {
      lines.push(`- ${server.id}: not running — start in Settings or call get_mcp_tools`)
    }
  }

  return lines.join('\n')
}

export default async (input: SystemPromptInput): Promise<string> => {
  const branch = await gitRepoInfo(input.projectRoot).catch(() => null)

  const rules = await listPyrolaFiles('project', 'rules', input.projectRoot).catch(() => [])
  const agents = await listPyrolaFiles('project', 'agents', input.projectRoot).catch(() => [])

  const agentCatalog = agents.length
    ? agents.map((agent) => ({
        name: agent.name,
        description: agent.description ?? agent.name,
      }))
    : input.agentCatalog

  const mentionBlock = input.mentions
    .map((mention) => {
      if (mention.type === 'file') {
        return `File ${mention.path}:\n${mention.content ?? ''}`
      }
      if (mention.type === 'folder') {
        return `Folder ${mention.path}:\n${mention.listing ?? ''}`
      }
      return `${mention.type} ${mention.type === 'rule' || mention.type === 'skill' ? mention.name : ''}`
    })
    .join('\n\n')

  const agentsBlock = agentCatalog
    .map((agent) => `- ${agent.name}: ${agent.description}`)
    .join('\n')

  const rulesBlock = rules.map((rule) => `- ${rule.name}`).join('\n')

  const toolCatalog = formatToolCatalogForMode(input.mode)
  const mcpCatalog = await formatMcpCatalog(input.projectRoot).catch(
    () => 'MCP catalog unavailable — call get_mcp_tools to inspect configured servers.',
  )

  const toolGuidance = [
    'Tool usage:',
    '- You already have the tool list below. Do not grep the repo just to discover built-in tools or MCP servers.',
    '- For MCP: use get_mcp_tools if the catalog below is stale, then call_mcp_tool with serverId and tool name.',
    '- Prefer edit_file or write_file for code changes. Do not use run_terminal to edit files.',
    '- apply_patch uses OpenCode format, NOT git diff. Example:',
    '  *** Update File: src/example.ts',
    '  @@',
    '  -old line',
    '  +new line',
    '- If a tool fails repeatedly, stop retrying the same approach and explain the blocker to the user.',
  ].join('\n')

  return [
    `You are Pyrola, an AI coding agent in ${input.mode} mode.`,
    `Project: ${input.projectName} (${input.projectRoot})`,
    branch?.currentBranch ? `Git branch: ${branch.currentBranch}` : '',
    'Use tools to explore and modify the codebase when appropriate.',
    toolGuidance,
    `Available tools in ${input.mode} mode:\n${toolCatalog}`,
    `Configured MCP servers and tools:\n${mcpCatalog}`,
    rulesBlock ? `Project rules:\n${rulesBlock}` : '',
    agentsBlock ? `Available subagents:\n${agentsBlock}` : '',
    mentionBlock ? `Context:\n${mentionBlock}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}
