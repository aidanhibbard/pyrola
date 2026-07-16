<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import ChatPromptInput from '@/components/chat/ChatPromptInput.vue'
import useChatStore from '@/composables/use-chat-store'
import useFleetRegistry from '@/composables/use-fleet-registry'
import { refreshFleetSidebar } from '@/composables/use-fleet-sidebar'
import { setPendingChatMessage } from '@/services/chat/pending-message'

const router = useRouter()
const fleet = useFleetRegistry()
const chatStore = useChatStore()
const sending = ref(false)

const handleSubmit = async (payload: {
  text: string
  mode: 'ask' | 'plan' | 'studio' | 'agent'
  model: string
}): Promise<void> => {
  const project = fleet.activeProject.value
  if (!project) {
    toast.error('No active project')
    return
  }

  sending.value = true
  try {
    const chat = await chatStore.createNewChat({
      projectSlug: project.slug,
      projectRoot: project.rootPath,
      mode: payload.mode,
      model: payload.model,
    })
    setPendingChatMessage(payload)
    await refreshFleetSidebar()
    await router.push(`/project/${project.slug}/chat/${chat.id}`)
  } catch (error) {
    toast.error('Could not start chat', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col items-center justify-center px-4">
    <ChatPromptInput
      show-project-select
      :disabled="sending"
      @submit="handleSubmit"
    />
  </div>
</template>
