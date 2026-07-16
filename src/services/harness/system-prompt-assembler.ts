import { listPyrolaFiles } from '@/services/pyrola/pyrola-tauri'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import type { ContextMention } from '@/types/harness/context-mention'
import gitRepoInfo from '@/services/git/git-repo-info'

export type SystemPromptInput = {
  mode: PyrolaChatMode
  projectName: string
  projectRoot: string
  mentions: ContextMention[]
  agentCatalog: Array<{ name: string; description: string }>
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

  const toolGuidance = [
    'Tool usage:',
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
    rulesBlock ? `Project rules:\n${rulesBlock}` : '',
    agentsBlock ? `Available subagents:\n${agentsBlock}` : '',
    mentionBlock ? `Context:\n${mentionBlock}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}
