import * as monaco from 'monaco-editor'
import useWorkbenchStore from '@/composables/use-workbench-store'
import type { EditorPayload } from '@/types/workbench/workbench-tab'

const RETRY_ATTEMPTS = 40
const RETRY_MS = 50

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })

const activeEditorPath = (
  workbench: ReturnType<typeof useWorkbenchStore>,
  projectId: string,
): string | null => {
  const tab = workbench.activeTab.value
  if (!tab || tab.type !== 'editor' || tab.projectId !== projectId) {
    return null
  }
  const payload = tab.payload as EditorPayload
  return payload.path || null
}

const revealLine = (line: number): boolean => {
  const editors = monaco.editor.getEditors()
  for (const editor of editors) {
    const model = editor.getModel()
    if (!model) {
      continue
    }
    const maxLine = model.getLineCount()
    if (maxLine < 1) {
      continue
    }
    const target = Math.min(Math.max(1, Math.trunc(line)), maxLine)
    editor.revealLineInCenter(target)
    editor.setPosition({ lineNumber: target, column: 1 })
    editor.focus()
    return true
  }
  return false
}

export default async (
  projectId: string,
  path: string,
  startLine?: number,
): Promise<void> => {
  const workbench = useWorkbenchStore()
  await workbench.openEditor(projectId, path)

  if (typeof startLine !== 'number' || !Number.isFinite(startLine) || startLine < 1) {
    return
  }

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
    if (activeEditorPath(workbench, projectId) !== path) {
      throw new Error('Editor switched away before the line could be revealed')
    }
    if (revealLine(startLine)) {
      return
    }
    await wait(RETRY_MS)
  }

  throw new Error('Editor did not become ready to reveal the line')
}
