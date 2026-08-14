import { computed, ref } from 'vue'

const hideCount = ref(0)

export default () => {
  const hidden = computed(() => hideCount.value > 0)

  const begin = (): void => {
    hideCount.value += 1
  }

  const end = (): void => {
    if (hideCount.value > 0) {
      hideCount.value -= 1
    }
  }

  return {
    hidden,
    begin,
    end,
  }
}
