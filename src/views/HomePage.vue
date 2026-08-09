<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import ChatPromptInput from '@/components/chat/ChatPromptInput.vue'
import useChatStore from '@/composables/use-chat-store'
import useFleetRegistry from '@/composables/use-fleet-registry'
import { refreshFleetSidebar } from '@/composables/use-fleet-sidebar'
import { setPendingChatMessage } from '@/services/chat/pending-message'
import { getUserHomeDir } from '@/services/pyrola/pyrola-tauri'
import { HOME_CHAT_SLUG } from '@/constants/home-chat'
import chatRouteFor from '@/utils/chat-route-for'
import type { PermissionLevel } from '@/types/harness/permission'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import type { ReasoningLevel } from '@/types/models/reasoning-level'

const router = useRouter()
const fleet = useFleetRegistry()
const chatStore = useChatStore()
const sending = ref(false)

onMounted(() => {
  chatStore.clearChatState()
})

const handleSubmit = async (payload: {
  text: string
  mode: PyrolaChatMode
  model: string
  reasoning?: ReasoningLevel
  projectId: string | null
  permissionLevel: PermissionLevel
}): Promise<void> => {
  sending.value = true
  try {
    if (payload.projectId) {
      await fleet.setActiveProject(payload.projectId)
    }

    const project = payload.projectId
      ? fleet.projects.value.find((item) => item.id === payload.projectId) ?? null
      : null

    const chat = project
      ? await chatStore.createNewChat({
          projectSlug: project.slug,
          projectRoot: project.rootPath,
          mode: payload.mode,
          model: payload.model,
        })
      : await chatStore.createNewChat({
          projectSlug: HOME_CHAT_SLUG,
          projectRoot: await getUserHomeDir(),
          mode: payload.mode,
          model: payload.model,
        })

    setPendingChatMessage({
      text: payload.text,
      mode: payload.mode,
      model: payload.model,
      permissionLevel: payload.permissionLevel,
      ...(payload.reasoning ? { reasoning: payload.reasoning } : {}),
    })
    await refreshFleetSidebar()
    await router.push(chatRouteFor(chat.projectSlug, chat.id))
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
