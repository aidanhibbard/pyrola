import type { Ref } from "vue"
import { createContext } from "reka-ui"

export const RIGHT_SIDEBAR_WIDTH = "16rem"

export const [useRightSidebar, provideRightSidebarContext] = createContext<{
  open: Ref<boolean>
  setOpen: (value: boolean) => void
  toggleSidebar: () => void
}>("RightSidebar")
