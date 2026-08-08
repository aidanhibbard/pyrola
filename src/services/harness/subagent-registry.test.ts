import { beforeEach, describe, expect, it } from 'vitest'

describe('subagent-registry', () => {
  beforeEach(async () => {
    const { resetSubagentRegistryForTests } = await import(
      '@/services/harness/subagent-registry'
    )
    resetSubagentRegistryForTests()
  })

  it('registers a background subagent and tracks it by chat', async () => {
    const { register, getSubagent, hasSubagent } = await import(
      '@/services/harness/subagent-registry'
    )

    const controller = new AbortController()
    const record = register('chat-1', 'sub-1', controller, {
      toolCallId: 'tc-1',
      agentName: 'explorer',
    })

    expect(record.status).toBe('running')
    expect(hasSubagent('sub-1')).toBe(true)
    expect(getSubagent('sub-1')?.chatId).toBe('chat-1')
  })

  it('resolves waiters when a subagent completes', async () => {
    const { register, resolve, waitFor } = await import(
      '@/services/harness/subagent-registry'
    )

    const controller = new AbortController()
    register('chat-1', 'sub-1', controller, {
      toolCallId: 'tc-1',
      agentName: 'explorer',
    })

    const resultPromise = waitFor('chat-1', 'sub-1')
    resolve('sub-1', {
      subagentId: 'sub-1',
      name: 'explorer',
      summary: 'done',
    })

    await expect(resultPromise).resolves.toEqual({
      subagentId: 'sub-1',
      name: 'explorer',
      summary: 'done',
    })
  })

  it('aborts all subagents for a chat', async () => {
    const { register, abort, listSubagentsForChat } = await import(
      '@/services/harness/subagent-registry'
    )

    const first = new AbortController()
    const second = new AbortController()
    register('chat-1', 'sub-1', first, {
      toolCallId: 'tc-1',
      agentName: 'first',
    })
    register('chat-1', 'sub-2', second, {
      toolCallId: 'tc-2',
      agentName: 'second',
    })

    abort('chat-1')

    const records = listSubagentsForChat('chat-1')
    expect(records.every((record) => record.status === 'aborted')).toBe(true)
    expect(first.signal.aborted).toBe(true)
    expect(second.signal.aborted).toBe(true)
  })

  it('stores and retrieves turn response messages for resume', async () => {
    const {
      setTurnResponseMessages,
      getTurnResponseMessages,
      clearTurnResponseMessages,
    } = await import('@/services/harness/subagent-registry')

    const messages = [{ role: 'assistant' as const, content: 'hello' }]
    setTurnResponseMessages('chat-1', messages)
    expect(getTurnResponseMessages('chat-1')).toEqual(messages)
    clearTurnResponseMessages('chat-1')
    expect(getTurnResponseMessages('chat-1')).toBeNull()
  })

  it('marks pending background resume on register and clears on abort', async () => {
    const {
      register,
      abort,
      hasPendingBackgroundResume,
      clearPendingBackgroundResume,
    } = await import('@/services/harness/subagent-registry')

    expect(hasPendingBackgroundResume('chat-1')).toBe(false)
    register('chat-1', 'sub-1', new AbortController(), {
      toolCallId: 'tc-1',
      agentName: 'explorer',
    })
    expect(hasPendingBackgroundResume('chat-1')).toBe(true)

    abort('chat-1')
    expect(hasPendingBackgroundResume('chat-1')).toBe(false)

    register('chat-1', 'sub-2', new AbortController(), {
      toolCallId: 'tc-2',
      agentName: 'other',
    })
    clearPendingBackgroundResume('chat-1')
    expect(hasPendingBackgroundResume('chat-1')).toBe(false)
  })

  it('can register without marking pending resume', async () => {
    const { register, hasPendingBackgroundResume } = await import(
      '@/services/harness/subagent-registry'
    )

    register(
      'chat-1',
      'sub-1',
      new AbortController(),
      { toolCallId: 'tc-1', agentName: 'blocking' },
      { pendingResume: false },
    )
    expect(hasPendingBackgroundResume('chat-1')).toBe(false)
  })

  it('lists only completed and failed results as deliverable', async () => {
    const {
      register,
      resolve,
      fail,
      abortOne,
      listDeliverableBackgroundResults,
      hasRunningSubagentsForChat,
    } = await import('@/services/harness/subagent-registry')

    register('chat-1', 'sub-1', new AbortController(), {
      toolCallId: 'tc-1',
      agentName: 'one',
    })
    register('chat-1', 'sub-2', new AbortController(), {
      toolCallId: 'tc-2',
      agentName: 'two',
    })
    register('chat-1', 'sub-3', new AbortController(), {
      toolCallId: 'tc-3',
      agentName: 'three',
    })
    register('chat-1', 'sub-4', new AbortController(), {
      toolCallId: 'tc-4',
      agentName: 'four',
    })

    resolve('sub-1', {
      subagentId: 'sub-1',
      name: 'one',
      summary: 'ok',
    })
    fail('sub-2', 'boom')
    abortOne('sub-3')

    expect(hasRunningSubagentsForChat('chat-1')).toBe(true)
    expect(listDeliverableBackgroundResults('chat-1')).toEqual([
      {
        toolCallId: 'tc-1',
        result: { subagentId: 'sub-1', name: 'one', summary: 'ok' },
      },
      {
        toolCallId: 'tc-2',
        result: { subagentId: 'sub-2', name: 'two', summary: 'boom' },
      },
    ])

    resolve('sub-4', {
      subagentId: 'sub-4',
      name: 'four',
      summary: 'last',
    })
    expect(hasRunningSubagentsForChat('chat-1')).toBe(false)
    expect(listDeliverableBackgroundResults('chat-1')).toHaveLength(3)
  })
})
