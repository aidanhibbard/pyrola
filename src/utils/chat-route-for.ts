import { HOME_CHAT_SLUG, isHomeChatSlug } from '@/constants/home-chat'

export default (
  projectSlug: string,
  chatId: string,
  subagentId?: string,
): string => {
  const base =
    isHomeChatSlug(projectSlug) || projectSlug === HOME_CHAT_SLUG
      ? `/chat/${chatId}`
      : `/project/${projectSlug}/chat/${chatId}`
  if (!subagentId) {
    return base
  }
  return `${base}/subagent/${subagentId}`
}
