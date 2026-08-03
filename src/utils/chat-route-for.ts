import { HOME_CHAT_SLUG, isHomeChatSlug } from '@/constants/home-chat'

export default (projectSlug: string, chatId: string): string => {
  if (isHomeChatSlug(projectSlug) || projectSlug === HOME_CHAT_SLUG) {
    return `/chat/${chatId}`
  }
  return `/project/${projectSlug}/chat/${chatId}`
}
