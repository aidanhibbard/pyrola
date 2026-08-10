import type CdpClient from '@/services/browser/cdp-client'
import { applyUserAgentOverride } from '@/services/browser/cdp-user-agent'
import type { HostUserAgentData } from '@/types/browser/host-user-agent-data'
import { listTabs, upsertTab } from '@/services/browser/registry'
import type { BrowserTab } from '@/types/browser/browser-tab'

type TargetInfo = {
  targetId?: string
  type?: string
  title?: string
  url?: string
}

type JsonTarget = {
  id?: string
  type?: string
  title?: string
  url?: string
}

const attachedSessions = new Map<string, string>()

const mapTargetToTab = (
  workspaceId: string,
  target: { id: string; url: string; title: string | null },
  existing: BrowserTab | undefined,
): BrowserTab => ({
  viewId: target.id,
  workspaceId,
  url: target.url,
  title: target.title,
  createdAt: existing?.createdAt ?? new Date().toISOString(),
})

export const getTabs = async (
  client: CdpClient,
  workspaceId: string,
  cdpEndpoint?: string,
): Promise<BrowserTab[]> => {
  const existingById = new Map(listTabs(workspaceId).map((tab) => [tab.viewId, tab]))
  let pages: Array<{ id: string; url: string; title: string | null }> = []

  if (cdpEndpoint) {
    const base = cdpEndpoint.replace(/\/$/, '')
    const response = await fetch(`${base}/json`)
    if (!response.ok) {
      throw new Error(`Failed to list CDP targets from ${base}: ${response.status}`)
    }
    const body = (await response.json()) as JsonTarget[]
    pages = (Array.isArray(body) ? body : [])
      .filter((target) => target.type === 'page' && typeof target.id === 'string')
      .map((target) => ({
        id: target.id as string,
        url: typeof target.url === 'string' ? target.url : '',
        title: typeof target.title === 'string' ? target.title : null,
      }))
  } else {
    const result = (await client.send('Target.getTargets')) as {
      targetInfos?: TargetInfo[]
    }
    pages = (Array.isArray(result.targetInfos) ? result.targetInfos : [])
      .filter((target) => target.type === 'page' && typeof target.targetId === 'string')
      .map((target) => ({
        id: target.targetId as string,
        url: typeof target.url === 'string' ? target.url : '',
        title: typeof target.title === 'string' ? target.title : null,
      }))
  }

  const tabs = pages.map((page) =>
    mapTargetToTab(workspaceId, page, existingById.get(page.id)),
  )
  for (const tab of tabs) {
    upsertTab(workspaceId, tab)
  }
  return tabs
}

export const createTab = async (
  client: CdpClient,
  url: string,
  userAgent: string,
  userAgentData?: HostUserAgentData | null,
): Promise<{ targetId: string; sessionId: string }> => {
  const result = (await client.send('Target.createTarget', { url })) as {
    targetId?: string
  }
  if (typeof result.targetId !== 'string' || result.targetId.length === 0) {
    throw new Error('Target.createTarget response missing targetId')
  }

  const { sessionId } = await client.attachToTarget(result.targetId, true)
  attachedSessions.set(result.targetId, sessionId)
  await applyUserAgentOverride(client, sessionId, userAgent, userAgentData)
  return { targetId: result.targetId, sessionId }
}

export const closeTab = async (client: CdpClient, targetId: string): Promise<void> => {
  await client.send('Target.closeTarget', { targetId })
  attachedSessions.delete(targetId)
}

export const selectTab = async (
  client: CdpClient,
  targetId: string,
  userAgent: string,
  userAgentData?: HostUserAgentData | null,
): Promise<{ sessionId: string }> => {
  const existing = attachedSessions.get(targetId)
  if (existing) {
    await applyUserAgentOverride(client, existing, userAgent, userAgentData)
    return { sessionId: existing }
  }

  const { sessionId } = await client.attachToTarget(targetId, true)
  attachedSessions.set(targetId, sessionId)
  await applyUserAgentOverride(client, sessionId, userAgent, userAgentData)
  return { sessionId }
}

export const resetAttachedSessionsForTests = (): void => {
  attachedSessions.clear()
}
