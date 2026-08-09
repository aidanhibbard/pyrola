import agentFrontmatterSchema from '@/schemas/agents/agent-frontmatter'
import type { AgentFrontmatter } from '@/schemas/agents/agent-frontmatter'
import stripMarkdownFrontmatter from '@/utils/strip-markdown-frontmatter'
import { isReasoningLevel } from '@/types/models/reasoning-level'

export type ParsedAgentMarkdown = {
  frontmatter: AgentFrontmatter
  body: string
}

export default (content: string): ParsedAgentMarkdown => {
  const stripped = stripMarkdownFrontmatter(content)
  const raw: Record<string, string> = { ...stripped.frontmatter }
  if (raw.reasoning && !isReasoningLevel(raw.reasoning)) {
    delete raw.reasoning
  }
  const parsed = agentFrontmatterSchema.safeParse(raw)
  return {
    frontmatter: parsed.success ? parsed.data : {},
    body: stripped.body,
  }
}
