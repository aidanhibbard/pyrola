import { ref, watch, type ComputedRef, type Ref } from 'vue'
import { toast } from 'vue-sonner'
import { pyrolaFileChangeToken } from '@/composables/use-pyrola-live-sync'
import useFleetRegistry from '@/composables/use-fleet-registry'
import { listSkillIndex } from '@/services/skills/skill-registry'
import type { PyrolaChatMode } from '@/types/pyrola/pyrola-settings'
import type { SkillIndexEntry } from '@/types/skills/skill'

type UseChatSkillsOptions = {
  mode: Ref<PyrolaChatMode> | ComputedRef<PyrolaChatMode>
}

export default (options: UseChatSkillsOptions) => {
  const fleet = useFleetRegistry()
  const skills = ref<SkillIndexEntry[]>([])
  const pending = ref(false)

  const refresh = async (): Promise<void> => {
    const project = fleet.activeProject.value
    if (!project) {
      skills.value = []
      return
    }

    pending.value = true
    try {
      skills.value = await listSkillIndex(options.mode.value, project.rootPath)
    } catch (error) {
      toast.error('Failed to load skills', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      pending.value = false
    }
  }

  watch(
    [() => options.mode.value, () => fleet.activeProject.value?.id, pyrolaFileChangeToken],
    () => {
      refresh().catch((error) => {
        toast.error('Failed to load skills', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    },
    { immediate: true },
  )

  return {
    skills,
    pending,
    refresh,
  }
}
