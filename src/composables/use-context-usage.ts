import { computed, ref } from 'vue'
import type { UIMessage } from 'ai'
import type { ContextBudget } from '@/types/harness/context-budget'
import type { ContextBucket } from '@/types/harness/context-bucket'
import type { ContextMention } from '@/types/harness/context-mention'
import type { PyrolaChatMode, PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import countContextBudget from '@/services/context/count-context-budget'
import parseModelRef from '@/utils/parse-model-ref'

const used = ref(0)
const limit = ref(128_000)
const buckets = ref<ContextBucket[]>([])
const modelId = ref('')
const pending = ref(false)

let refreshGeneration = 0

export type RefreshContextUsageInput = {
  modelId: string
  mode: PyrolaChatMode
  projectName: string
  projectRoot: string
  mentions?: ContextMention[]
  messages: UIMessage[]
  settings?: PyrolaSettings
  standalone?: boolean
}

export default () => {
  const ratio = computed(() => (limit.value > 0 ? used.value / limit.value : 0))

  const percentUsed = computed(() => Math.round(ratio.value * 1000) / 10)

  const visibleBuckets = computed(() =>
    buckets.value.filter((bucket) => bucket.tokens > 0),
  )

  const setBudget = (budget: ContextBudget): void => {
    used.value = budget.used
    limit.value = budget.limit
    buckets.value = budget.buckets
    modelId.value = budget.modelId
  }

  const refresh = async (input: RefreshContextUsageInput): Promise<void> => {
    const generation = ++refreshGeneration
    pending.value = true

    try {
      const parsed = parseModelRef(input.modelId)
      const budget = await countContextBudget({
        modelId: parsed?.modelId ?? input.modelId,
        providerId: parsed?.providerId,
        settings: input.settings,
        mode: input.mode,
        projectName: input.projectName,
        projectRoot: input.projectRoot,
        mentions: input.mentions ?? [],
        messages: input.messages,
        standalone: input.standalone,
      })

      if (generation !== refreshGeneration) {
        return
      }

      setBudget(budget)
    } finally {
      if (generation === refreshGeneration) {
        pending.value = false
      }
    }
  }

  return {
    used,
    limit,
    buckets,
    modelId,
    pending,
    ratio,
    percentUsed,
    visibleBuckets,
    setBudget,
    refresh,
  }
}
