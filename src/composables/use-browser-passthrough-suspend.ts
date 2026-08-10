import { computed, ref } from 'vue'

const suspendCount = ref(0)

export default () => {
  const suspended = computed(() => suspendCount.value > 0)

  const suspend = (): void => {
    suspendCount.value += 1
  }

  const resume = (): void => {
    if (suspendCount.value > 0) {
      suspendCount.value -= 1
    }
  }

  return {
    suspended,
    suspend,
    resume,
  }
}
