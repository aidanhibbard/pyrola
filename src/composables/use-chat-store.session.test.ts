import { beforeEach, describe, expect, it, vi } from 'vitest'

const metaFor = (id: string) => ({
  id,
  title: id,
  projectSlug: 'proj',
  projectRoot: '/proj',
  mode: 'agent',
  model: 'test/model',
  status: 'idle' as const,
  attention: null,
  createdAt: '2020-01-01T00:00:00.000Z',
  updatedAt: '2020-01-01T00:00:00.000Z',
  forkedFrom: null,
  pinned: false,
  pinnedAt: null,
})

vi.mock('@/services/pyrola/pyrola-tauri', () => ({
  createChat: vi.fn(),
  listChats: vi.fn(),
  readChatMeta: vi.fn(async (_slug: string, chatId: string) => metaFor(chatId)),
  readChatMessages: vi.fn().mockResolvedValue([]),
  updateChatMeta: vi.fn(async (_slug: string, chatId: string, patch: Record<string, unknown>) => ({
    ...metaFor(chatId),
    ...patch,
  })),
}))

describe('chat session registry isolation', () => {
  beforeEach(async () => {
    vi.resetModules()
  })

  it('keeps session A timeline when active session is B', async () => {
    const { default: useChatStore, resetChatSessionsForTests } = await import(
      '@/composables/use-chat-store'
    )
    resetChatSessionsForTests()
    const store = useChatStore()

    const sessionA = store.forChat('proj', 'chat-a')
    sessionA.startAgentTurn('turn-a')
    sessionA.appendLocalTextDelta('hello from A', 'turn-a')

    await store.loadChat('proj', 'chat-b')
    const sessionB = store.forChat('proj', 'chat-b')
    sessionB.startAgentTurn('turn-b')
    sessionB.appendLocalTextDelta('hello from B', 'turn-b')

    expect(
      store.timeline.value.some(
        (item) => item.type === 'agent-turn' && item.turn.id === 'turn-b',
      ),
    ).toBe(true)
    expect(
      store.timeline.value.some(
        (item) => item.type === 'agent-turn' && item.turn.id === 'turn-a',
      ),
    ).toBe(false)

    const stillA = store.forChat('proj', 'chat-a')
    expect(
      stillA.timeline.value.some(
        (item) => item.type === 'agent-turn' && item.turn.id === 'turn-a',
      ),
    ).toBe(true)
    expect(
      stillA.timeline.value.some(
        (item) => item.type === 'agent-turn' && item.turn.id === 'turn-b',
      ),
    ).toBe(false)
  })

  it('clearChatState does not wipe other sessions', async () => {
    const { default: useChatStore, resetChatSessionsForTests } = await import(
      '@/composables/use-chat-store'
    )
    resetChatSessionsForTests()
    const store = useChatStore()
    const sessionA = store.forChat('proj', 'chat-a')
    sessionA.startAgentTurn('turn-a')
    sessionA.appendLocalTextDelta('keep me', 'turn-a')
    // Mark warm without wiping timeline: loadChat on empty disk after mutations
    // would hydrate empty. Use isSessionWarm via create path instead.
    await store.loadChat('proj', 'chat-a')
    // After cold hydrate the timeline is empty from disk; seed again on warm session
    const warmA = store.forChat('proj', 'chat-a')
    warmA.startAgentTurn('turn-a')
    warmA.appendLocalTextDelta('keep me', 'turn-a')

    store.clearChatState()

    expect(store.meta.value).toBeNull()
    expect(store.isSessionWarm('proj', 'chat-a')).toBe(true)
    expect(
      store.forChat('proj', 'chat-a').timeline.value.some(
        (item) => item.type === 'agent-turn' && item.turn.id === 'turn-a',
      ),
    ).toBe(true)
  })
})
