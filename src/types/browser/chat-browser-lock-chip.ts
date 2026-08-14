export type ChatBrowserLockChipState =
  | {
      kind: 'owner'
      sessionId: string
    }
  | {
      kind: 'queued'
      sessionId: string
      ownerChatId: string
      ownerTitle: string | null
      ownerProjectSlug: string | null
    }
