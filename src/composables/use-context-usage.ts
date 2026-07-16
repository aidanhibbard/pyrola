import { computed, ref } from 'vue'

export default () => {
  const used = ref(0)
  const limit = ref(128_000)

  const ratio = computed(() => (limit.value > 0 ? used.value / limit.value : 0))

  const setUsage = (nextUsed: number, nextLimit?: number): void => {
    used.value = nextUsed
    if (nextLimit !== undefined) {
      limit.value = nextLimit
    }
  }

  return {
    used,
    limit,
    ratio,
    setUsage,
  }
}
