import {
  bumpRevision,
  cefSessions,
  getOrCreateWorkspace,
  workspaces,
} from '@/services/browser/cef-store'

export const getChatPreferredSession = (
  workspaceId: string,
  chatId: string,
): string | null => {
  const index = workspaces.get(workspaceId)
  if (!index) {
    return null
  }
  const sessionId = index.preferredSessionByChatId.get(chatId)
  if (!sessionId || !cefSessions.has(sessionId)) {
    return null
  }
  return sessionId
}

export const setChatPreferredSession = (chatId: string, sessionId: string): void => {
  const entry = cefSessions.get(sessionId)
  if (!entry) {
    return
  }
  const index = getOrCreateWorkspace(entry.workspaceId)
  index.preferredSessionByChatId.set(chatId, sessionId)
  bumpRevision()
}

export const assignExclusivePreferredSession = (
  chatId: string,
  sessionId: string,
): void => {
  const entry = cefSessions.get(sessionId)
  if (!entry) {
    return
  }
  dropPreferredForSession(entry.workspaceId, sessionId)
  setChatPreferredSession(chatId, sessionId)
}

export const clearChatPreferredSession = (chatId: string): void => {
  let changed = false
  for (const index of workspaces.values()) {
    if (index.preferredSessionByChatId.delete(chatId)) {
      changed = true
    }
  }
  if (changed) {
    bumpRevision()
  }
}

export const dropPreferredForSession = (workspaceId: string, sessionId: string): void => {
  const index = workspaces.get(workspaceId)
  if (!index) {
    return
  }
  let changed = false
  for (const [chatId, preferred] of index.preferredSessionByChatId) {
    if (preferred === sessionId) {
      index.preferredSessionByChatId.delete(chatId)
      changed = true
    }
  }
  if (changed) {
    bumpRevision()
  }
}

export const getPreferredChatIdForSession = (
  workspaceId: string,
  sessionId: string,
): string | null => {
  const index = workspaces.get(workspaceId)
  if (!index) {
    return null
  }
  for (const [chatId, preferred] of index.preferredSessionByChatId) {
    if (preferred === sessionId) {
      return chatId
    }
  }
  return null
}

export const bindPreferredIfUnset = (args: {
  workspaceId: string
  chatId: string
  sessionId: string
}): void => {
  if (getChatPreferredSession(args.workspaceId, args.chatId)) {
    return
  }
  setChatPreferredSession(args.chatId, args.sessionId)
}
