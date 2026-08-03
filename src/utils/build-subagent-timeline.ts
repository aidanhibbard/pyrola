import type { UIMessage } from 'ai'
import type { AgentTurn } from '@/types/chat/agent-turn'
import type { ChatTimelineItem, SubagentTimelineItem } from '@/types/chat/chat-timeline-item'

export default (subagent: SubagentTimelineItem): ChatTimelineItem[] => {
  const items: ChatTimelineItem[] = []

  if (subagent.prompt?.trim()) {
    const message: UIMessage = {
      id: `${subagent.subagentId}-prompt`,
      role: 'user',
      parts: [{ type: 'text', text: subagent.prompt.trim() }],
    }
    items.push({ type: 'user', message })
  }

  const turn: AgentTurn = {
    id: `${subagent.subagentId}-turn`,
    text: subagent.summary?.trim() ?? '',
    steps: [
      {
        id: `${subagent.subagentId}-step`,
        text: '',
        reasoning: '',
        tools: subagent.tools,
      },
    ],
  }

  const hasContent =
    turn.text.length > 0 ||
    turn.steps.some((step) => step.tools.length > 0)

  if (hasContent) {
    items.push({ type: 'agent-turn', turn })
  }

  return items
}
