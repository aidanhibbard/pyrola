import { describe, expect, it } from 'vitest'
import {
  aggregateTurnFileDiffs,
  collectMutationsAfterUserMessage,
  resolveBaselinesForRevert,
  summarizeMutationCounts,
} from '@/services/harness/restore-file-checkpoints'
import type { AgentTurn } from '@/types/chat/agent-turn'
import type { ChatTimelineItem } from '@/types/chat/chat-timeline-item'

const makeTurn = (id: string, diffs: AgentTurn['steps'][0]['tools'][0]['diffs']): AgentTurn => ({
  id,
  text: '',
  steps: [
    {
      id: `${id}-step`,
      text: '',
      reasoning: '',
      tools: [
        {
          toolCallId: `${id}-tool`,
          name: 'write_file',
          status: 'done',
          diffs,
        },
      ],
    },
  ],
})

describe('restore-file-checkpoints aggregation', () => {
  it('aggregates turn diffs by path', () => {
    const turn = makeTurn('t1', [
      {
        path: 'a.ts',
        operation: 'update',
        hunks: [
          {
            oldStart: 1,
            newStart: 1,
            lines: [
              { kind: 'remove', content: 'old' },
              { kind: 'add', content: 'new' },
            ],
          },
        ],
      },
      {
        path: 'b.ts',
        operation: 'create',
        hunks: [
          {
            oldStart: 1,
            newStart: 1,
            lines: [{ kind: 'add', content: 'x' }],
          },
        ],
      },
    ])

    const changes = aggregateTurnFileDiffs(turn)
    expect(changes).toHaveLength(2)
    expect(changes.map((item) => item.path)).toEqual(['a.ts', 'b.ts'])
    expect(summarizeMutationCounts(changes)).toMatchObject({
      files: 2,
      created: 1,
      updated: 1,
    })
  })

  it('collects mutations after a user message and resolves baselines', () => {
    const timeline: ChatTimelineItem[] = [
      {
        type: 'user',
        message: {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'one' }],
        },
      },
      {
        type: 'agent-turn',
        turn: makeTurn('t1', [
          {
            path: 'a.ts',
            operation: 'update',
            hunks: [],
          },
        ]),
      },
      {
        type: 'user',
        message: {
          id: 'u2',
          role: 'user',
          parts: [{ type: 'text', text: 'two' }],
        },
      },
      {
        type: 'agent-turn',
        turn: makeTurn('t2', [
          {
            path: 'a.ts',
            operation: 'update',
            hunks: [],
          },
          {
            path: 'c.ts',
            operation: 'create',
            hunks: [],
          },
        ]),
      },
    ]

    const afterU1 = collectMutationsAfterUserMessage(timeline, 'u1')
    expect(afterU1.map((item) => item.path).sort()).toEqual(['a.ts', 'c.ts'])

    const targets = resolveBaselinesForRevert(timeline, 'u1')
    expect(targets).toEqual([
      { path: 'a.ts', userMessageId: 'u1' },
      { path: 'c.ts', userMessageId: 'u2' },
    ])
  })
})
