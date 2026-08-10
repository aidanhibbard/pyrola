import agentFrontmatterSchema from '@/schemas/agents/agent-frontmatter'
import type { AgentFrontmatter } from '@/schemas/agents/agent-frontmatter'
import stripMarkdownFrontmatter from '@/utils/strip-markdown-frontmatter'
import { isReasoningLevel } from '@/types/models/reasoning-level'

export type ParsedAgentMarkdown = {
  frontmatter: AgentFrontmatter
  body: string
}

const parseToolsValue = (raw: string): string[] | undefined => {
  const trimmed = raw.trim()
  if (!trimmed) {
    return undefined
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (
        Array.isArray(parsed) &&
        parsed.every((item): item is string => typeof item === 'string')
      ) {
        return parsed
      }
    } catch {
      return undefined
    }
    return undefined
  }

  const tools = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  return tools.length > 0 ? tools : undefined
}

export default (content: string): ParsedAgentMarkdown => {
  const stripped = stripMarkdownFrontmatter(content)
  const raw: Record<string, unknown> = { ...stripped.frontmatter }
  if (typeof raw.reasoning === 'string' && !isReasoningLevel(raw.reasoning)) {
    delete raw.reasoning
  }
  if (typeof raw.tools === 'string') {
    const tools = parseToolsValue(raw.tools)
    if (tools) {
      raw.tools = tools
    } else {
      delete raw.tools
    }
  }
  const parsed = agentFrontmatterSchema.safeParse(raw)
  return {
    frontmatter: parsed.success ? parsed.data : {},
    body: stripped.body,
  }
}
