import type { ModelMessage } from 'ai'
import type { SubagentRecord, SubagentResult, SubagentStatus } from '@/types/harness/subagent-record'

type CompletionWaiter = (result: SubagentResult) => void

const subagents = new Map<string, SubagentRecord>()
const chatSubagents = new Map<string, Set<string>>()
const controllers = new Map<string, AbortController>()
const completionWaiters = new Map<string, CompletionWaiter[]>()
const turnResponseMessages = new Map<string, ModelMessage[]>()

const setSubagentStatus = (
  record: SubagentRecord,
  status: SubagentStatus,
  result?: SubagentResult,
): void => {
  record.status = status
  if (result) {
    record.result = result
  }
}

const trackSubagentForChat = (chatId: string, subagentId: string): void => {
  const existing = chatSubagents.get(chatId) ?? new Set<string>()
  existing.add(subagentId)
  chatSubagents.set(chatId, existing)
}

const resolveCompletionWaiters = (subagentId: string, result: SubagentResult): void => {
  const waiters = completionWaiters.get(subagentId) ?? []
  completionWaiters.delete(subagentId)
  for (const resolve of waiters) {
    resolve(result)
  }
}

export const register = (
  chatId: string,
  subagentId: string,
  controller: AbortController,
  meta: { toolCallId: string; agentName: string },
): SubagentRecord => {
  const record: SubagentRecord = {
    subagentId,
    chatId,
    toolCallId: meta.toolCallId,
    agentName: meta.agentName,
    status: 'running',
    startedAt: new Date().toISOString(),
  }

  subagents.set(subagentId, record)
  controllers.set(subagentId, controller)
  trackSubagentForChat(chatId, subagentId)
  return record
}

export const resolve = (subagentId: string, result: SubagentResult): void => {
  const record = subagents.get(subagentId)
  if (!record || record.status !== 'running') {
    return
  }

  setSubagentStatus(record, 'completed', result)
  controllers.delete(subagentId)
  resolveCompletionWaiters(subagentId, result)
}

export const fail = (subagentId: string, summary: string): void => {
  const record = subagents.get(subagentId)
  if (!record || record.status !== 'running') {
    return
  }

  const result: SubagentResult = {
    subagentId,
    name: record.agentName,
    summary,
  }
  setSubagentStatus(record, 'failed', result)
  controllers.delete(subagentId)
  resolveCompletionWaiters(subagentId, result)
}

export const waitFor = (chatId: string, subagentId: string): Promise<SubagentResult> => {
  const record = subagents.get(subagentId)
  if (!record || record.chatId !== chatId) {
    return Promise.reject(new Error(`Subagent not found: ${subagentId}`))
  }

  if (record.status !== 'running' && record.result) {
    return Promise.resolve(record.result)
  }

  return new Promise((resolvePromise) => {
    const waiters = completionWaiters.get(subagentId) ?? []
    waiters.push(resolvePromise)
    completionWaiters.set(subagentId, waiters)
  })
}

export const getSubagent = (subagentId: string): SubagentRecord | null =>
  subagents.get(subagentId) ?? null

export const hasSubagent = (subagentId: string): boolean => subagents.has(subagentId)

export const listSubagentsForChat = (chatId: string): SubagentRecord[] => {
  const ids = chatSubagents.get(chatId)
  if (!ids) {
    return []
  }

  return [...ids]
    .map((subagentId) => subagents.get(subagentId))
    .filter((record): record is SubagentRecord => record !== undefined)
}

export const hasRunningSubagentsForChat = (chatId: string): boolean =>
  listSubagentsForChat(chatId).some((record) => record.status === 'running')

export const getRunningSubagentForChat = (chatId: string): SubagentRecord | null =>
  listSubagentsForChat(chatId).find((record) => record.status === 'running') ?? null

export const setTurnResponseMessages = (chatId: string, messages: ModelMessage[]): void => {
  turnResponseMessages.set(chatId, messages)
}

export const getTurnResponseMessages = (chatId: string): ModelMessage[] | null =>
  turnResponseMessages.get(chatId) ?? null

export const clearTurnResponseMessages = (chatId: string): void => {
  turnResponseMessages.delete(chatId)
}

export const abort = (chatId: string): void => {
  const ids = chatSubagents.get(chatId)
  if (!ids) {
    return
  }

  for (const subagentId of [...ids]) {
    const record = subagents.get(subagentId)
    if (!record || record.status !== 'running') {
      continue
    }

    const controller = controllers.get(subagentId)
    controller?.abort()
    controllers.delete(subagentId)

    const result: SubagentResult = {
      subagentId,
      name: record.agentName,
      summary: 'Subagent aborted',
    }
    setSubagentStatus(record, 'aborted', result)
    resolveCompletionWaiters(subagentId, result)
  }

  chatSubagents.delete(chatId)
  turnResponseMessages.delete(chatId)
}

export const resetSubagentRegistryForTests = (): void => {
  subagents.clear()
  chatSubagents.clear()
  controllers.clear()
  completionWaiters.clear()
  turnResponseMessages.clear()
}
