import type { EditorPayload } from '@/types/workbench/workbench-tab'
import workbenchTabLabel from '@/utils/workbench-tab-label'
import { tabs } from './state'
import { updateTab } from './helpers'

export const normalizeEditorPayload = (payload: EditorPayload): EditorPayload => {
  const openPaths =
    payload.openPaths && payload.openPaths.length > 0
      ? payload.openPaths
      : payload.path
        ? [payload.path]
        : []
  const path = openPaths.includes(payload.path) ? payload.path : (openPaths[0] ?? '')
  return {
    path,
    openPaths,
    ...(payload.diffView === true ? { diffView: true } : {}),
  }
}

export const addEditorFile = (tabId: string, path: string, diffView?: boolean): void => {
  const tab = tabs.value.find((item) => item.id === tabId)
  if (!tab || tab.type !== 'editor') {
    return
  }

  const payload = normalizeEditorPayload(tab.payload as EditorPayload)
  const openPaths = payload.openPaths.includes(path)
    ? payload.openPaths
    : [...payload.openPaths, path]
  const fileName = path.split('/').pop() ?? path
  const nextDiffView = diffView === true

  updateTab(tabId, {
    label: fileName,
    payload: {
      path,
      openPaths,
      ...(nextDiffView ? { diffView: true } : {}),
    } satisfies EditorPayload,
  })
}

export const setEditorActivePath = (tabId: string, path: string): void => {
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
    payload: {
      path,
      openPaths: payload.openPaths,
      ...(payload.diffView === true ? { diffView: true } : {}),
    } satisfies EditorPayload,
  })
}

export const setEditorDiffView = (tabId: string, diffView: boolean): void => {
  const tab = tabs.value.find((item) => item.id === tabId)
  if (!tab || tab.type !== 'editor') {
    return
  }

  const payload = normalizeEditorPayload(tab.payload as EditorPayload)
  updateTab(tabId, {
    payload: {
      path: payload.path,
      openPaths: payload.openPaths,
      ...(diffView ? { diffView: true } : {}),
    } satisfies EditorPayload,
  })
}

export const closeEditorFile = async (tabId: string, path: string): Promise<void> => {
  const tab = tabs.value.find((item) => item.id === tabId)
  if (!tab || tab.type !== 'editor') {
    return
  }

  const payload = normalizeEditorPayload(tab.payload as EditorPayload)
  const openPaths = payload.openPaths.filter((item) => item !== path)

  if (openPaths.length === 0) {
    updateTab(tabId, {
      label: workbenchTabLabel('editor'),
      dirty: false,
      payload: { path: '', openPaths: [] } satisfies EditorPayload,
    })
    return
  }

  const nextPath =
    payload.path === path ? openPaths[openPaths.length - 1]! : payload.path
  const fileName = nextPath.split('/').pop() ?? nextPath

  updateTab(tabId, {
    label: fileName,
    payload: {
      path: nextPath,
      openPaths,
      ...(payload.diffView === true ? { diffView: true } : {}),
    } satisfies EditorPayload,
  })
}

export const setEditorTabDirty = (tabId: string, dirty: boolean): void => {
  updateTab(tabId, { dirty })
}
