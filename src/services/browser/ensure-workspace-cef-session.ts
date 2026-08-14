import createCefSession from '@/services/browser/create-cef-session'
import {
  getLastInteractedViewId,
  listTabs,
} from '@/services/browser/registry'

const inflight = new Map<string, Promise<string>>()

const existingSessionId = (workspaceId: string): string | null => {
  const last = getLastInteractedViewId(workspaceId)
  if (last) {
    return last
  }
  return listTabs(workspaceId)[0]?.viewId ?? null
}

const ensureWorkspaceCefSession = async (workspaceId: string): Promise<string> => {
  const existing = existingSessionId(workspaceId)
  if (existing) {
    return existing
  }
  const pending = inflight.get(workspaceId)
  if (pending) {
    return pending
  }
  const created = createCefSession(workspaceId)
  inflight.set(workspaceId, created)
  try {
    return await created
  } finally {
    inflight.delete(workspaceId)
  }
}

export default ensureWorkspaceCefSession
