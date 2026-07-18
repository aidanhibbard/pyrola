import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { pyrolaFileChangeToken } from '@/composables/use-pyrola-live-sync'
import useFleetRegistry from '@/composables/use-fleet-registry'
import { listUserAndProjectSkillIndex } from '@/services/skills/skill-registry'
import type { SkillIndexEntry } from '@/types/skills/skill'

export default () => {
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
      skills.value = await listUserAndProjectSkillIndex(project.rootPath)
    } catch (error) {
      toast.error('Failed to load skills', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      pending.value = false
    }
  }

  watch(
    [() => fleet.activeProject.value?.id, pyrolaFileChangeToken],
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
