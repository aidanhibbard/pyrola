export type BrowserLock = {
  sessionId: string
  workspaceId: string
  ownerChatId: string
  ownerSubagentId: string | null
  /** Same as sessionId for CEF (legacy field kept for UI). */
  viewId: string | null
}
