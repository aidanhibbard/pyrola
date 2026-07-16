import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import useFleetRegistry from '@/composables/use-fleet-registry'
import gitCheckoutBranch from '@/services/git/git-checkout-branch'
import gitListBranches from '@/services/git/git-list-branches'
import gitRepoInfo from '@/services/git/git-repo-info'

const isRepo = ref(false)
const currentBranch = ref<string | null>(null)
const branches = ref<string[]>([])
const pending = ref(false)
const checkoutPending = ref(false)

let refreshGeneration = 0

export default () => {
  const fleet = useFleetRegistry()

  const rootPath = computed(() => fleet.activeProject.value?.rootPath ?? null)

  const refresh = async (): Promise<void> => {
    const path = rootPath.value
    const generation = ++refreshGeneration

    if (!path) {
      isRepo.value = false
      currentBranch.value = null
      branches.value = []
      pending.value = false
      return
    }

    pending.value = true

    try {
      const info = await gitRepoInfo(path)
      if (generation !== refreshGeneration) {
        return
      }

      isRepo.value = info.isRepo
      currentBranch.value = info.currentBranch

      if (!info.isRepo) {
        branches.value = []
        return
      }

      branches.value = await gitListBranches(path)
      if (generation !== refreshGeneration) {
        return
      }

      if (info.currentBranch && !branches.value.includes(info.currentBranch)) {
        branches.value = [info.currentBranch, ...branches.value]
      }
    } catch (error) {
      if (generation !== refreshGeneration) {
        return
      }
      isRepo.value = false
      currentBranch.value = null
      branches.value = []
      toast.error('Failed to load git branches', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      if (generation === refreshGeneration) {
        pending.value = false
      }
    }
  }

  const checkoutBranch = async (branch: string): Promise<void> => {
    const path = rootPath.value
    if (!path || branch === currentBranch.value) {
      return
    }

    checkoutPending.value = true

    try {
      await gitCheckoutBranch(path, branch)
      await refresh()
      toast.success('Switched branch', {
        description: branch,
      })
    } catch (error) {
      toast.error('Could not switch branch', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      checkoutPending.value = false
    }
  }

  watch(rootPath, async () => {
    await refresh()
  }, { immediate: true })

  return {
    isRepo,
    currentBranch,
    branches,
    pending,
    checkoutPending,
    refresh,
    checkoutBranch,
  }
}
