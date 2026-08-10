import type { Ref } from 'vue'

export type BrowserTabSessionArgs = {
  workspaceId: string
  addressBarValue: Ref<string>
  canBack: Ref<boolean>
  canForward: Ref<boolean>
  pageTitle: Ref<string>
  pageUrl: Ref<string>
  cefReady: Ref<boolean>
  hasPage: Ref<boolean>
  isTabActive: Ref<boolean>
  addressInputRef: Ref<HTMLInputElement | null>
  hostEl: Ref<HTMLElement | null>
}
