import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { pyrolaFileChangeToken } from '@/composables/use-pyrola-live-sync'
import useFleetRegistry from '@/composables/use-fleet-registry'
import { listSlashSkillIndex } from '@/services/skills/skill-registry'
import formatUnknownError from '@/utils/format-unknown-error'
import type { SkillIndexEntry } from '@/types/skills/skill'

export default () => {
  const fleet = useFleetRegistry()
  const skills = ref<SkillIndexEntry[]>([])
  const pending = ref(false)

  const refresh = async (): Promise<void> => {
    pending.value = true
    try {
      skills.value = await listSlashSkillIndex(
        fleet.activeProject.value?.rootPath ?? null,
      )
    } catch (error) {
      toast.error('Failed to load skills', {
        description: formatUnknownError(error),
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
          description: formatUnknownError(error),
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
