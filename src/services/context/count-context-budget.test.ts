import { describe, expect, it, vi } from 'vitest'
import type { UIMessage } from 'ai'

vi.mock('@/services/context/estimate-builtin-tool-definition-tokens', () => ({
  default: () => 100,
}))

vi.mock('@/services/pyrola/pyrola-tauri', () => ({
  mcpListStatuses: async () => ({}),
  readMcpConfig: async () => ({ servers: {} }),
  listPyrolaFiles: async () => [],
  fsReadFile: async () => ({ content: '' }),
}))

vi.mock('tokenlens', () => ({
  getContext: () => ({ maxInput: 100_000, maxTotal: 100_000 }),
}))

vi.mock('@/services/context/system-prompt-parts', async () => {
  const actual = await vi.importActual<
    typeof import('@/services/context/system-prompt-parts')
  >('@/services/context/system-prompt-parts')
  return {
    ...actual,
    default: async () => ({
      base: 'base-system',
      tools: 'tool-catalog-prose',
      mcp: 'mcp-catalog',
      rules: 'rules-body',
      subagents: 'subagents',
      mentions: '',
      skills: 'skills',
    }),
  }
})

import countContextBudget from '@/services/context/count-context-budget'

const message = (id: string, createdAt: string, text: string): UIMessage => ({
  id,
  role: 'user',
  parts: [{ type: 'text', text }],
  metadata: { createdAt },
})

describe('countContextBudget', () => {
  it('applies activeContext cutoff to the conversation bucket', async () => {
    const longOld = 'x'.repeat(4000)
    const shortNew = 'y'.repeat(40)
    const withoutCutoff = await countContextBudget({
      modelId: 'gpt-4.1',
      mode: 'agent',
      projectName: 'demo',
      projectRoot: '/tmp/demo',
      mentions: [],
      messages: [
        message('1', '2026-01-01T00:00:00.000Z', longOld),
        message('2', '2026-01-03T00:00:00.000Z', shortNew),
      ],
    })
    const withCutoff = await countContextBudget({
      modelId: 'gpt-4.1',
      mode: 'agent',
      projectName: 'demo',
      projectRoot: '/tmp/demo',
      mentions: [],
      messages: [
        message('1', '2026-01-01T00:00:00.000Z', longOld),
        message('2', '2026-01-03T00:00:00.000Z', shortNew),
      ],
      activeContext: {
        summary: 'checkpoint',
        includeFromCreatedAt: '2026-01-03T00:00:00.000Z',
      },
    })

    const messagesWithout = withoutCutoff.buckets.find((b) => b.id === 'messages')?.tokens ?? 0
    const messagesWith = withCutoff.buckets.find((b) => b.id === 'messages')?.tokens ?? 0
    expect(messagesWith).toBeLessThan(messagesWithout)
    expect(withCutoff.buckets.some((b) => b.id === 'mcp')).toBe(true)
    expect(withCutoff.buckets.find((b) => b.id === 'tools')?.tokens).toBe(100)
  })
})
