import type { FleetChatStatus } from './fleet-chat-status'

export interface FleetSidebarChat {
  id: string
  title: string
  updatedAtLabel: string
  status?: FleetChatStatus
  pinned?: boolean
}
