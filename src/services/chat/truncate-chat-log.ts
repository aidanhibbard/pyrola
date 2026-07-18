import { truncateChatLog } from '@/services/pyrola/pyrola-tauri'

export const truncateChatLogBeforeMessage = async (
  projectSlug: string,
  chatId: string,
  messageId: string,
): Promise<void> => {
  await truncateChatLog({
    projectSlug,
    chatId,
    beforeMessageId: messageId,
  })
}

export const truncateChatLogAfterLastUser = async (
  projectSlug: string,
  chatId: string,
): Promise<void> => {
  await truncateChatLog({
    projectSlug,
    chatId,
    keepThroughLastUser: true,
  })
}
