import type { FileUIPart } from 'ai'
import type { QueuedChatMessage } from '@/types/chat/queued-chat-message'
import { usePromptInput } from '@/components/ai-elements/prompt-input/context'
import { toast } from 'vue-sonner'

const dataUrlToFile = async (part: FileUIPart): Promise<File | null> => {
  if (!part.url.startsWith('data:')) {
    return null
  }
  try {
    const response = await fetch(part.url)
    const blob = await response.blob()
    return new File([blob], part.filename || 'attachment', {
      type: part.mediaType || blob.type || 'application/octet-stream',
    })
  }
  catch {
    return null
  }
}

export default () => {
  // Resolves only inside a <PromptInput> subtree; throws otherwise.
  const { setTextInput, clearFiles, addFiles } = usePromptInput()

  const hydrateQueuedMessage = async (item: QueuedChatMessage): Promise<void> => {
    clearFiles()
    setTextInput(item.text)

    if (item.files.length === 0) {
      return
    }

    const settled = await Promise.all(item.files.map(dataUrlToFile))
    const restored = settled.filter((file): file is File => file !== null)

    if (restored.length === 0) {
      return
    }

    if (restored.length < item.files.length) {
      toast.error('Some attachments could not be restored')
    }

    addFiles(restored)
  }

  return {
    hydrateQueuedMessage,
  }
}
