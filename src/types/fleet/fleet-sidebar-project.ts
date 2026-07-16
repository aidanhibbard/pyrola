import type { FleetSidebarChat } from './fleet-sidebar-chat'

export interface FleetSidebarProject {
  slug: string
  displayName: string
  isActiveProject?: boolean
  defaultExpanded?: boolean
  chats: FleetSidebarChat[]
  hiddenChatCount?: number
  hiddenChats?: FleetSidebarChat[]
}
