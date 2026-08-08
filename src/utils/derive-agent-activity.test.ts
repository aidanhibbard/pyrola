import { describe, expect, it } from 'vitest'
import type { AgentTurn } from '@/types/chat/agent-turn'
import type { SubagentTimelineItem } from '@/types/chat/chat-timeline-item'
import deriveAgentActivity from '@/utils/derive-agent-activity'

const turn = (partial: Partial<AgentTurn> & { id?: string }): AgentTurn => ({
  id: partial.id ?? 'turn-1',
  steps: partial.steps ?? [],
  text: partial.text ?? '',
  error: partial.error,
})

const subagent = (
  partial: Partial<SubagentTimelineItem> & { subagentId: string; name: string },
): SubagentTimelineItem => ({
  type: 'subagent',
  subagentId: partial.subagentId,
  name: partial.name,
  blocking: partial.blocking ?? true,
  status: partial.status ?? 'running',
  tools: partial.tools ?? [],
  toolCallId: partial.toolCallId,
  summary: partial.summary,
  prompt: partial.prompt,
  model: partial.model,
})

describe('deriveAgentActivity', () => {
  it('returns null when idle with nothing running', () => {
    expect(
      deriveAgentActivity({
        status: 'ready',
        turn: turn({}),
        runningSubagents: [],
      }),
    ).toBeNull()
  })

  it('prefers pending approval', () => {
    expect(
      deriveAgentActivity({
        status: 'streaming',
        turn: turn({}),
        runningSubagents: [
          subagent({ subagentId: 's1', name: 'Reading auth', blocking: true }),
        ],
        hasPendingApproval: true,
      }),
    ).toBe('Waiting for approval')
  })

  it('waits for a blocking subagent', () => {
    expect(
      deriveAgentActivity({
        status: 'streaming',
        turn: turn({
          steps: [
            {
              id: 'step-1',
              text: '',
              reasoning: '',
              tools: [
                {
                  toolCallId: 't1',
                  name: 'spawn_subagent',
                  status: 'running',
                  args: { agentName: 'Reading auth' },
                },
              ],
            },
          ],
        }),
        runningSubagents: [
          subagent({
            subagentId: 's1',
            name: 'Reading auth',
            blocking: true,
            toolCallId: 't1',
          }),
        ],
      }),
    ).toBe('Waiting for Reading auth')
  })

  it('prefers a parent tool over background subagent wait', () => {
    expect(
      deriveAgentActivity({
        status: 'streaming',
        turn: turn({
          steps: [
            {
              id: 'step-1',
              text: '',
              reasoning: '',
              tools: [
                {
                  toolCallId: 't1',
                  name: 'edit_file',
                  status: 'running',
                  args: { path: 'src/a.ts' },
                },
              ],
            },
          ],
        }),
        runningSubagents: [
          subagent({
            subagentId: 's1',
            name: 'Scanning permissions',
            blocking: false,
          }),
        ],
      }),
    ).toBe('Editing src/a.ts…')
  })

  it('waits for background subagents when parent is ready', () => {
    expect(
      deriveAgentActivity({
        status: 'ready',
        turn: turn({
          steps: [
            {
              id: 'step-1',
              text: 'Done spawning.',
              reasoning: '',
              tools: [
                {
                  toolCallId: 't1',
                  name: 'spawn_subagent',
                  status: 'done',
                  args: { agentName: 'Scanning permissions' },
                  result: { subagentId: 's1', status: 'running' },
                },
              ],
            },
          ],
        }),
        runningSubagents: [
          subagent({
            subagentId: 's1',
            name: 'Scanning permissions',
            blocking: false,
          }),
        ],
      }),
    ).toBe('Waiting for Scanning permissions')
  })

  it('shows Writing plan while create_plan is running', () => {
    expect(
      deriveAgentActivity({
        status: 'streaming',
        turn: turn({
          steps: [
            {
              id: 'step-1',
              text: '',
              reasoning: '',
              tools: [
                {
                  toolCallId: 't1',
                  name: 'create_plan',
                  status: 'running',
                  args: { title: 'Ship it' },
                },
              ],
            },
          ],
        }),
        runningSubagents: [],
      }),
    ).toBe('Writing plan…')
  })

  it('shows Working before first content', () => {
    expect(
      deriveAgentActivity({
        status: 'submitted',
        turn: turn({}),
        runningSubagents: [],
      }),
    ).toBe('Working')
  })

  it('shows Starting while spawn is running before subagent-start', () => {
    expect(
      deriveAgentActivity({
        status: 'streaming',
        turn: turn({
          steps: [
            {
              id: 'step-1',
              text: '',
              reasoning: '',
              tools: [
                {
                  toolCallId: 't1',
                  name: 'spawn_subagent',
                  status: 'running',
                  args: { agentName: 'Reading auth' },
                },
              ],
            },
          ],
        }),
        runningSubagents: [],
      }),
    ).toBe('Starting Reading auth…')
  })
})
