import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type {
  BrowserPayload,
  ChangesPayload,
  EditorPayload,
  PlanPayload,
  StudioPayload,
  TerminalPayload,
  WorkbenchTab,
  WorkbenchTabType,
} from '@/types/workbench/workbench-tab'
import type { PyrolaDuplicateTabBehavior } from '@/types/pyrola/pyrola-settings'
import useFleetRegistry from '@/composables/use-fleet-registry'
import usePyrolaConfig from '@/composables/use-pyrola-config'
import { pyrolaFileChangeToken } from '@/composables/use-pyrola-live-sync'
import { shellKillPty, shellWritePty } from '@/services/pyrola/pyrola-tauri'

type DuplicateTabResolution = 'existing' | 'new'

type PromptableTabType = Exclude<WorkbenchTabType, 'plan' | 'studio'>

type ResolveWorkbenchTabOpenParams = {
  projectId: string
  type: PromptableTabType
  predicate: (tab: WorkbenchTab) => boolean
}

const tabs = ref<WorkbenchTab[]>([])
const activeTabId = ref<string | null>(null)
const rightSidebarOpen = ref(false)
const terminalSessions = new Map<string, string>()
const tabRefreshTokens = ref<Record<string, number>>({})
const duplicateDialogOpen = ref(false)
const duplicateDialogTabType = ref<PromptableTabType>('editor')

let duplicateDialogResolve: ((value: DuplicateTabResolution) => void) | null = null

const createId = (): string => crypto.randomUUID()

const getProject = (projectId: string) => {
  const fleet = useFleetRegistry()
  return fleet.projects.value.find((p) => p.id === projectId) ?? null
}

const resolveProjectIdByRoot = (projectRoot: string): string | null => {
  const fleet = useFleetRegistry()
  return fleet.projects.value.find((p) => p.rootPath === projectRoot)?.id ?? null
}

const ensureSidebarOpen = (): void => {
  rightSidebarOpen.value = true
}

const focusTab = (id: string): void => {
  if (!tabs.value.some((tab) => tab.id === id)) {
    return
  }
  activeTabId.value = id
  ensureSidebarOpen()
}

const findTab = (
  predicate: (tab: WorkbenchTab) => boolean,
): WorkbenchTab | undefined => tabs.value.find(predicate)

const updateTab = (id: string, patch: Partial<WorkbenchTab>): void => {
  const index = tabs.value.findIndex((tab) => tab.id === id)
  if (index < 0) {
    return
  }
  tabs.value[index] = { ...tabs.value[index]!, ...patch }
}

const normalizeEditorPayload = (payload: EditorPayload): EditorPayload => {
  const openPaths =
    payload.openPaths && payload.openPaths.length > 0
      ? payload.openPaths
      : payload.path
        ? [payload.path]
        : []
  const path = openPaths.includes(payload.path) ? payload.path : (openPaths[0] ?? '')
  return { path, openPaths }
}

const addEditorFile = (tabId: string, path: string): void => {
  const tab = tabs.value.find((item) => item.id === tabId)
  if (!tab || tab.type !== 'editor') {
    return
  }

  const payload = normalizeEditorPayload(tab.payload as EditorPayload)
  const openPaths = payload.openPaths.includes(path) ? payload.openPaths : [...payload.openPaths, path]
  const fileName = path.split('/').pop() ?? path

  updateTab(tabId, {
    label: fileName,
    payload: { path, openPaths } satisfies EditorPayload,
  })
}

const setEditorActivePath = (tabId: string, path: string): void => {
  const tab = tabs.value.find((item) => item.id === tabId)
  if (!tab || tab.type !== 'editor') {
    return
  }

  const payload = normalizeEditorPayload(tab.payload as EditorPayload)
  if (!payload.openPaths.includes(path)) {
    return
  }

  const fileName = path.split('/').pop() ?? path
  updateTab(tabId, {
    label: fileName,
    payload: { path, openPaths: payload.openPaths } satisfies EditorPayload,
  })
}

const closeEditorFile = async (tabId: string, path: string): Promise<void> => {
  const tab = tabs.value.find((item) => item.id === tabId)
  if (!tab || tab.type !== 'editor') {
    return
  }

  const payload = normalizeEditorPayload(tab.payload as EditorPayload)
  const openPaths = payload.openPaths.filter((item) => item !== path)

  if (openPaths.length === 0) {
    await closeTab(tabId)
    return
  }

  const nextPath =
    payload.path === path ? openPaths[openPaths.length - 1]! : payload.path
  const fileName = nextPath.split('/').pop() ?? nextPath

  updateTab(tabId, {
    label: fileName,
    payload: { path: nextPath, openPaths } satisfies EditorPayload,
  })
}

const setEditorTabDirty = (tabId: string, dirty: boolean): void => {
  updateTab(tabId, { dirty })
}

const resolveWorkbenchTabOpen = async (
  params: ResolveWorkbenchTabOpenParams,
): Promise<DuplicateTabResolution> => {
  const existing = findTab(params.predicate)
  if (!existing) {
    return 'new'
  }

  const config = usePyrolaConfig()
  const behavior =
    config.effectiveSettings.value['workbench.duplicateTabBehavior'] ?? 'ask'

  if (behavior === 'open-existing') {
    return 'existing'
  }
  if (behavior === 'open-new') {
    return 'new'
  }

  if (duplicateDialogOpen.value) {
    return 'new'
  }

  duplicateDialogTabType.value = params.type
  duplicateDialogOpen.value = true

  return new Promise<DuplicateTabResolution>((resolve) => {
    duplicateDialogResolve = resolve
  })
}

const confirmDuplicateTabChoice = async (
  choice: DuplicateTabResolution,
  dontAskAgain: boolean,
): Promise<void> => {
  if (!duplicateDialogResolve) {
    return
  }

  const resolve = duplicateDialogResolve
  duplicateDialogResolve = null
  duplicateDialogOpen.value = false
  resolve(choice)

  if (!dontAskAgain) {
    return
  }

  const behavior: PyrolaDuplicateTabBehavior =
    choice === 'existing' ? 'open-existing' : 'open-new'

  try {
    const config = usePyrolaConfig()
    await config.updateSetting('personal', 'workbench.duplicateTabBehavior', behavior)
  } catch (error) {
    toast.error('Failed to save preference', {
      description: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const cancelDuplicateTabDialog = (): void => {
  if (!duplicateDialogResolve) {
    duplicateDialogOpen.value = false
    return
  }

  const resolve = duplicateDialogResolve
  duplicateDialogResolve = null
  duplicateDialogOpen.value = false
  resolve('new')
}

const openEditor = async (projectId: string, path: string): Promise<void> => {
  const predicate = (tab: WorkbenchTab) => tab.type === 'editor' && tab.projectId === projectId
  const existing = findTab(predicate)

  if (existing) {
    addEditorFile(existing.id, path)
    focusTab(existing.id)
    return
  }

  const fileName = path.split('/').pop() ?? path
  const tab: WorkbenchTab = {
    id: createId(),
    type: 'editor',
    projectId,
    label: fileName,
    payload: { path, openPaths: [path] } satisfies EditorPayload,
  }
  tabs.value.push(tab)
  focusTab(tab.id)
}

const openTerminal = async (projectId: string, label?: string): Promise<void> => {
  const predicate = (tab: WorkbenchTab) => tab.type === 'terminal' && tab.projectId === projectId
  const existing = findTab(predicate)

  if (existing) {
    const resolution = await resolveWorkbenchTabOpen({
      projectId,
      type: 'terminal',
      predicate,
    })
    if (resolution === 'existing') {
      focusTab(existing.id)
      return
    }
  }

  const project = getProject(projectId)
  const tabLabel = label ?? project?.slug ?? 'Terminal'
  const tab: WorkbenchTab = {
    id: createId(),
    type: 'terminal',
    projectId,
    label: tabLabel,
    payload: { sessionId: null } satisfies TerminalPayload,
  }
  tabs.value.push(tab)
  focusTab(tab.id)
}

const openPlan = (projectId: string, planId: string, path: string, label?: string): void => {
  const existing = findTab(
    (tab) => tab.type === 'plan' && (tab.payload as PlanPayload).planId === planId,
  )
  if (existing) {
    focusTab(existing.id)
    return
  }

  const tab: WorkbenchTab = {
    id: createId(),
    type: 'plan',
    projectId,
    label: label ?? planId,
    payload: { planId, path } satisfies PlanPayload,
  }
  tabs.value.push(tab)
  focusTab(tab.id)
}

const openStudio = (
  projectId: string,
  artifactSlug: string,
  path: string,
  label?: string,
): void => {
  const existing = findTab(
    (tab) =>
      tab.type === 'studio' && (tab.payload as StudioPayload).artifactSlug === artifactSlug,
  )
  if (existing) {
    updateTab(existing.id, {
      label: label ?? artifactSlug,
      payload: { artifactSlug, path } satisfies StudioPayload,
    })
    focusTab(existing.id)
    return
  }

  const tab: WorkbenchTab = {
    id: createId(),
    type: 'studio',
    projectId,
    label: label ?? artifactSlug,
    payload: { artifactSlug, path } satisfies StudioPayload,
  }
  tabs.value.push(tab)
  focusTab(tab.id)
}

const openChanges = async (projectId: string): Promise<void> => {
  const predicate = (tab: WorkbenchTab) => tab.type === 'changes' && tab.projectId === projectId
  const existing = findTab(predicate)

  if (existing) {
    const resolution = await resolveWorkbenchTabOpen({
      projectId,
      type: 'changes',
      predicate,
    })
    if (resolution === 'existing') {
      focusTab(existing.id)
      return
    }
  }

  const tab: WorkbenchTab = {
    id: createId(),
    type: 'changes',
    projectId,
    label: 'Changes',
    payload: {} satisfies ChangesPayload,
  }
  tabs.value.push(tab)
  focusTab(tab.id)
}

const openBrowser = async (projectId: string, url: string): Promise<void> => {
  const predicate = (tab: WorkbenchTab) =>
    tab.type === 'browser' &&
    tab.projectId === projectId &&
    (tab.payload as BrowserPayload).url === url
  const existing = findTab(predicate)

  if (existing) {
    const resolution = await resolveWorkbenchTabOpen({
      projectId,
      type: 'browser',
      predicate,
    })
    if (resolution === 'existing') {
      focusTab(existing.id)
      return
    }
  }

  let label = url
  try {
    label = new URL(url).hostname
  } catch {
    label = url.slice(0, 24)
  }

  const tab: WorkbenchTab = {
    id: createId(),
    type: 'browser',
    projectId,
    label,
    payload: { url } satisfies BrowserPayload,
  }
  tabs.value.push(tab)
  focusTab(tab.id)
}

const closeTab = async (id: string): Promise<void> => {
  const tab = tabs.value.find((item) => item.id === id)
  if (!tab) {
    return
  }

  if (tab.type === 'terminal') {
    const sessionId = terminalSessions.get(id)
    if (sessionId) {
      try {
        await shellKillPty(sessionId)
      } catch (error) {
        toast.error('Failed to close terminal', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
      terminalSessions.delete(id)
    }
  }

  const index = tabs.value.findIndex((item) => item.id === id)
  if (index < 0) {
    return
  }
  tabs.value.splice(index, 1)

  if (activeTabId.value === id) {
    const next = tabs.value[index] ?? tabs.value[index - 1] ?? null
    activeTabId.value = next?.id ?? null
  }
}

const closeOthers = async (id: string): Promise<void> => {
  const toClose = tabs.value.filter((tab) => tab.id !== id).map((tab) => tab.id)
  for (const tabId of toClose) {
    await closeTab(tabId)
  }
  focusTab(id)
}

const closeAll = async (): Promise<void> => {
  const toClose = tabs.value.map((tab) => tab.id)
  for (const tabId of toClose) {
    await closeTab(tabId)
  }
}

const reorderTabs = (fromIndex: number, toIndex: number): void => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return
  }
  const next = [...tabs.value]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) {
    return
  }
  next.splice(toIndex, 0, moved)
  tabs.value = next
}

const registerTerminalSession = (tabId: string, sessionId: string): void => {
  terminalSessions.set(tabId, sessionId)
  const tab = tabs.value.find((item) => item.id === tabId)
  if (tab?.type === 'terminal') {
    updateTab(tabId, {
      payload: { sessionId } satisfies TerminalPayload,
    })
  }
}

const unregisterTerminalSession = (tabId: string): void => {
  terminalSessions.delete(tabId)
}

const getActiveTerminalSessionId = (): string | null => {
  const active = tabs.value.find((tab) => tab.id === activeTabId.value)
  if (!active || active.type !== 'terminal') {
    return null
  }
  return terminalSessions.get(active.id) ?? null
}

const writeToActiveTerminal = async (data: string): Promise<boolean> => {
  const sessionId = getActiveTerminalSessionId()
  if (!sessionId) {
    return false
  }
  await shellWritePty(sessionId, data)
  return true
}

const refreshPlanStudioTabs = (): void => {
  for (const tab of tabs.value) {
    if (tab.type === 'plan' || tab.type === 'studio') {
      tabRefreshTokens.value[tab.id] = (tabRefreshTokens.value[tab.id] ?? 0) + 1
    }
  }
}

const setRightSidebarOpen = (open: boolean): void => {
  rightSidebarOpen.value = open
}

const toggleRightSidebar = (): void => {
  rightSidebarOpen.value = !rightSidebarOpen.value
}

const activeTab = computed(() => tabs.value.find((tab) => tab.id === activeTabId.value) ?? null)

const hasMultipleProjects = computed(() => {
  const ids = new Set(tabs.value.map((tab) => tab.projectId))
  return ids.size > 1
})

watch(pyrolaFileChangeToken, () => {
  refreshPlanStudioTabs()
})

export default () => ({
  tabs,
  activeTabId,
  activeTab,
  rightSidebarOpen,
  tabRefreshTokens,
  hasMultipleProjects,
  duplicateDialogOpen,
  duplicateDialogTabType,
  focusTab,
  openEditor,
  openTerminal,
  openPlan,
  openStudio,
  openChanges,
  openBrowser,
  closeTab,
  closeOthers,
  closeAll,
  reorderTabs,
  registerTerminalSession,
  unregisterTerminalSession,
  getActiveTerminalSessionId,
  writeToActiveTerminal,
  refreshPlanStudioTabs,
  setRightSidebarOpen,
  toggleRightSidebar,
  getProject,
  resolveProjectIdByRoot,
  confirmDuplicateTabChoice,
  cancelDuplicateTabDialog,
  addEditorFile,
  setEditorActivePath,
  closeEditorFile,
  setEditorTabDirty,
})
