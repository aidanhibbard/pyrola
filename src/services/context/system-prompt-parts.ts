import { listPyrolaFiles } from '@/services/pyrola/pyrola-tauri'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import type { ContextMention } from '@/types/harness/context-mention'
import gitRepoInfo from '@/services/git/git-repo-info'
import { formatToolCatalogForMode } from '@/services/harness/tool-catalog'
import { migrateMcpConfig } from '@/schemas/mcp-config'
import { listEffectiveMcpServers } from '@/services/mcp/merge-mcp-config'
import loadPrompt from '@/services/prompts/load-prompt'
import { loadInternalSkill } from '@/services/skills/discover-internal-skills'
import { listSkillIndex } from '@/services/skills/skill-registry'
import { mcpStatus, readMcpConfig } from '@/services/pyrola/pyrola-tauri'

export type SystemPromptInput = {
  mode: PyrolaChatMode
  projectName: string
  projectRoot: string
  mentions: ContextMention[]
  agentCatalog: Array<{ name: string; description: string }>
}

export type SystemPromptParts = {
  base: string
  tools: string
  mcp: string
  rules: string
  subagents: string
  mentions: string
  skills: string
}

const formatMcpCatalog = async (projectRoot: string): Promise<string> => {
  const personal = migrateMcpConfig(await readMcpConfig('personal', null))
  const projectRaw = await readMcpConfig('project', projectRoot).catch(() => null)
  const project = projectRaw ? migrateMcpConfig(projectRaw) : null
  const servers = listEffectiveMcpServers(personal, project)

  if (servers.length === 0) {
    return ''
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

const formatMentionBlocks = (
  mentions: ContextMention[],
): { mentions: string; skills: string } => {
  const mentionLines: string[] = []
  const skillLines: string[] = []

  for (const mention of mentions) {
    if (mention.type === 'file') {
      mentionLines.push(`File ${mention.path}:\n${mention.content ?? ''}`)
      continue
    }
    if (mention.type === 'folder') {
      mentionLines.push(`Folder ${mention.path}:\n${mention.listing ?? ''}`)
      continue
    }
    if (mention.type === 'skill') {
      skillLines.push(`Skill ${mention.name}`)
      continue
    }
    if (mention.type === 'rule') {
      mentionLines.push(`Rule ${mention.name}`)
    }
  }

  return {
    mentions: mentionLines.join('\n\n'),
    skills: skillLines.join('\n'),
  }
}

// Auto-inject the active mode skill at assembly time instead of requiring
// load_skill("<mode>") at turn start — avoids an extra tool round-trip while
// keeping mode guidance in src/skills/<mode>/SKILL.md.
const resolveModeSkillBlock = (mode: PyrolaChatMode): string => {
  const loaded = loadInternalSkill(mode)
  return loaded?.content ?? ''
}

export default async (input: SystemPromptInput): Promise<SystemPromptParts> => {
  const branch = await gitRepoInfo(input.projectRoot).catch(() => null)

  const rules = await listPyrolaFiles('project', 'rules', input.projectRoot).catch(() => [])
  const agents = await listPyrolaFiles('project', 'agents', input.projectRoot).catch(() => [])

  const agentCatalog = agents.length
    ? agents.map((agent) => ({
        name: agent.name,
        description: agent.description ?? agent.name,
      }))
    : input.agentCatalog

  const { mentions, skills: mentionSkills } = formatMentionBlocks(input.mentions)

  const skillIndex = await listSkillIndex(input.mode, input.projectRoot).catch(() => [])
  const skillIndexBlock =
    skillIndex.length > 0
      ? skillIndex.map((skill) => `- ${skill.name}: ${skill.description}`).join('\n')
      : ''
  const skills = [skillIndexBlock ? `Available skills:\n${skillIndexBlock}` : '', mentionSkills]
    .filter(Boolean)
    .join('\n\n')

  const agentsBlock = agentCatalog
    .map((agent) => `- ${agent.name}: ${agent.description}`)
    .join('\n')

  const rulesBlock = rules.map((rule) => `- ${rule.name}`).join('\n')

  const toolCatalog = formatToolCatalogForMode(input.mode)
  const mcpCatalog = await formatMcpCatalog(input.projectRoot).catch(() => '')

  const branchSuffix = branch?.currentBranch ? `\n\nGit branch: ${branch.currentBranch}` : ''
  const modeSkillBlock = resolveModeSkillBlock(input.mode)

  const base = [
    loadPrompt('system/base.md', {
      mode: input.mode,
      projectName: input.projectName,
      projectRoot: input.projectRoot,
      branchSuffix,
    }),
    loadPrompt('system/tool-guidance.md'),
    modeSkillBlock,
  ]
    .filter(Boolean)
    .join('\n\n')

  return {
    base,
    tools: toolCatalog ? `Available tools in ${input.mode} mode:\n${toolCatalog}` : '',
    mcp: mcpCatalog ? `Configured MCP servers and tools:\n${mcpCatalog}` : '',
    rules: rulesBlock ? `Project rules:\n${rulesBlock}` : '',
    subagents: agentsBlock ? `Available subagents:\n${agentsBlock}` : '',
    mentions: mentions ? `Context:\n${mentions}` : '',
    skills,
  }
}

export const joinSystemPromptParts = (parts: SystemPromptParts): string =>
  [
    parts.base,
    parts.tools,
    parts.mcp,
    parts.rules,
    parts.subagents,
    parts.mentions,
    parts.skills,
  ]
    .filter(Boolean)
    .join('\n\n')
