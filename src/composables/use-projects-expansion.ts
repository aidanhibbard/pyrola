import { ref } from 'vue'

type ExpansionMode = 'natural' | 'all-collapsed' | 'all-expanded'

const expansionMode = ref<ExpansionMode>('natural')

export default () => {
  const resolveOpen = (defaultExpanded: boolean, manualOpen: boolean | null): boolean => {
    if (expansionMode.value === 'all-collapsed') {
      return false
    }
    if (expansionMode.value === 'all-expanded') {
      return true
    }
    if (manualOpen !== null) {
      return manualOpen
    }
    return defaultExpanded
  }

  const toggleCollapseAll = (): void => {
    expansionMode.value = expansionMode.value === 'all-collapsed' ? 'all-expanded' : 'all-collapsed'
  }

  const onProjectOpenChange = (): void => {
    expansionMode.value = 'natural'
  }

  const isAllCollapsed = (): boolean => expansionMode.value === 'all-collapsed'

  return {
    expansionMode,
    resolveOpen,
    toggleCollapseAll,
    onProjectOpenChange,
    isAllCollapsed,
  }
}
