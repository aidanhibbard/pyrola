import { computed, ref } from 'vue'
import type { UIMessage } from 'ai'
import type { ContextBudget } from '@/types/harness/context-budget'
import type { ContextBucket } from '@/types/harness/context-bucket'
import type { ContextMention } from '@/types/harness/context-mention'
import type { PrefixSnapshot } from '@/types/harness/prefix-snapshot'
import type { PyrolaChatMode, PyrolaSettings } from '@/types/pyrola/pyrola-settings'
import countContextBudget from '@/services/context/count-context-budget'
import parseModelRef from '@/utils/parse-model-ref'

const used = ref(0)
const promptUsed = ref(0)
const limit = ref(128_000)
const reservedOutput = ref(8192)
const safetyBuffer = ref(2000)
const free = ref(0)
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
  frozenSnapshot?: PrefixSnapshot | null
}

export default () => {
  const usablePrompt = computed(() =>
    Math.max(0, limit.value - reservedOutput.value - safetyBuffer.value),
  )

  const ratio = computed(() =>
    usablePrompt.value > 0 ? promptUsed.value / usablePrompt.value : 0,
  )

  const percentUsed = computed(() => Math.round(ratio.value * 1000) / 10)

  const visibleBuckets = computed(() =>
    buckets.value.filter((bucket) => bucket.tokens > 0),
  )

  const setBudget = (budget: ContextBudget): void => {
    promptUsed.value = budget.promptUsed
    used.value = budget.used
    limit.value = budget.limit
    reservedOutput.value = budget.reservedOutput
    safetyBuffer.value = budget.safetyBuffer
    free.value = budget.free
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
        frozenSnapshot: input.frozenSnapshot,
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
    promptUsed,
    limit,
    reservedOutput,
    safetyBuffer,
    free,
    usablePrompt,
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
