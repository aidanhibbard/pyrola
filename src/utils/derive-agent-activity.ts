import type { ChatStatus } from 'ai'
import type { AgentTurn } from '@/types/chat/agent-turn'
import type { SubagentTimelineItem } from '@/types/chat/chat-timeline-item'
import type { ToolRun } from '@/types/harness/tool-run'
import formatToolRunLabel from '@/utils/format-tool-run-label'

type DeriveAgentActivityArgs = {
  status: ChatStatus
  turn: AgentTurn | null
  runningSubagents: SubagentTimelineItem[]
  hasPendingApproval?: boolean
  hasPendingQuestion?: boolean
}

const waitForSubagentsLabel = (subagents: SubagentTimelineItem[]): string => {
  if (subagents.length === 1) {
    const name = subagents[0]!.name.trim() || 'Sub-agent'
    return `Waiting for ${name}`
  }
  return `Waiting for ${subagents.length} sub-agents`
}

const collectRunningTools = (turn: AgentTurn): ToolRun[] => {
  const tools: ToolRun[] = []
  for (const step of turn.steps) {
    for (const tool of step.tools) {
      if (tool.status === 'running') {
        tools.push(tool)
      }
    }
  }
  return tools
}

const hasTurnContent = (turn: AgentTurn): boolean =>
  turn.steps.some(
    (step) =>
      step.reasoning.trim().length > 0 ||
      step.text.trim().length > 0 ||
      step.tools.length > 0,
  ) || turn.text.trim().length > 0

export default (args: DeriveAgentActivityArgs): string | null => {
  if (args.hasPendingApproval) {
    return 'Waiting for approval'
  }
  if (args.hasPendingQuestion) {
    return 'Waiting for your answer'
  }

  const isLive = args.status === 'streaming' || args.status === 'submitted'
  const runningSubagents = args.runningSubagents.filter(
    (item) => item.status === 'running',
  )
  const blockingSubagents = runningSubagents.filter((item) => item.blocking)
  const backgroundSubagents = runningSubagents.filter((item) => !item.blocking)

  const runningTools = args.turn ? collectRunningTools(args.turn) : []
  const nonSpawnRunning = runningTools.filter(
    (tool) => tool.name !== 'spawn_subagent',
  )
  const spawnRunning = runningTools.filter(
    (tool) => tool.name === 'spawn_subagent',
  )

  if (blockingSubagents.length > 0) {
    return waitForSubagentsLabel(blockingSubagents)
  }

  if (nonSpawnRunning.length > 0) {
    return formatToolRunLabel(nonSpawnRunning[nonSpawnRunning.length - 1]!)
  }

  if (spawnRunning.length > 0 && runningSubagents.length === 0) {
    return formatToolRunLabel(spawnRunning[spawnRunning.length - 1]!)
  }

  if (isLive && args.turn) {
    const lastStep = args.turn.steps.at(-1)
    if (lastStep) {
      const hasText =
        lastStep.text.trim().length > 0 || args.turn.text.trim().length > 0
      const hasReasoning = lastStep.reasoning.trim().length > 0
      if (
        hasText &&
        lastStep.tools.length === 0 &&
        backgroundSubagents.length === 0
      ) {
        return 'Writing'
      }
      if (
        hasReasoning &&
        !hasText &&
        lastStep.tools.length === 0 &&
        backgroundSubagents.length === 0
      ) {
        return 'Thinking'
      }
    }
  }

  if (backgroundSubagents.length > 0) {
    return waitForSubagentsLabel(backgroundSubagents)
  }

  if (!isLive) {
    return null
  }

  if (!args.turn || !hasTurnContent(args.turn)) {
    return 'Working'
  }

  const lastStep = args.turn.steps.at(-1)
  if (
    lastStep &&
    lastStep.reasoning.trim().length > 0 &&
    lastStep.text.trim().length === 0 &&
    lastStep.tools.length === 0
  ) {
    return 'Thinking'
  }
  if (
    lastStep &&
    (lastStep.text.trim().length > 0 || args.turn.text.trim().length > 0) &&
    lastStep.tools.length === 0
  ) {
    return 'Writing'
  }
  return 'Thinking'
}
