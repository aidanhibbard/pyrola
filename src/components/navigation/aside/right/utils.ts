import type { Ref } from 'vue'
import { createContext } from 'reka-ui'

export const [useRightSidebar, provideRightSidebarContext] = createContext<{
  open: Ref<boolean>
  setOpen: (value: boolean) => void
  toggleSidebar: () => void
}>('RightSidebar')
