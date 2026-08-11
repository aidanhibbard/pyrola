import type CdpClient from '@/services/browser/cdp-client'

type InspectNodeRequestedParams = {
  backendNodeId?: unknown
}

const INSPECT_HIGHLIGHT = {
  borderColor: { r: 255, g: 0, b: 0, a: 0.9 },
  contentColor: { r: 255, g: 0, b: 0, a: 0.15 },
  showInfo: true,
} as const

const matchesSession = (eventSessionId: string | undefined, sessionId: string): boolean =>
  eventSessionId === undefined || eventSessionId === sessionId

const activeByClient = new WeakMap<CdpClient, Map<string, () => void>>()

const getActiveMap = (client: CdpClient): Map<string, () => void> => {
  let map = activeByClient.get(client)
  if (!map) {
    map = new Map()
    activeByClient.set(client, map)
  }
  return map
}

const clearListener = (client: CdpClient, sessionId: string): void => {
  const map = activeByClient.get(client)
  if (!map) {
    return
  }
  const unsubscribe = map.get(sessionId)
  if (!unsubscribe) {
    return
  }
  unsubscribe()
  map.delete(sessionId)
}

const bestEffortSend = async (
  client: CdpClient,
  method: string,
  params: Record<string, unknown>,
  sessionId: string,
): Promise<void> => {
  try {
    await client.send(method, params, sessionId)
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
  }
}

export const startInspectMode = async (
  client: CdpClient,
  sessionId: string,
  onPick: (backendNodeId: number) => void,
): Promise<() => void> => {
  clearListener(client, sessionId)

  // Overlay.inspectMode requires the DOM domain (and a synced document).
  await client.send('DOM.enable', {}, sessionId)
  await client.send('DOM.getDocument', { depth: 0 }, sessionId)
  await client.send('Overlay.enable', {}, sessionId)
  await client.send(
    'Overlay.setInspectMode',
    {
      mode: 'searchForNode',
      highlightConfig: {
        borderColor: { ...INSPECT_HIGHLIGHT.borderColor },
        contentColor: { ...INSPECT_HIGHLIGHT.contentColor },
        showInfo: INSPECT_HIGHLIGHT.showInfo,
      },
    },
    sessionId,
  )

  const unsubscribe = client.on(
    'Overlay.inspectNodeRequested',
    (params, eventSessionId) => {
      if (!matchesSession(eventSessionId, sessionId)) {
        return
      }
      const payload = (params ?? {}) as InspectNodeRequestedParams
      if (typeof payload.backendNodeId !== 'number') {
        return
      }
      onPick(payload.backendNodeId)
    },
  )

  getActiveMap(client).set(sessionId, unsubscribe)

  return () => {
    clearListener(client, sessionId)
  }
}

export const stopInspectMode = async (
  client: CdpClient,
  sessionId: string,
): Promise<void> => {
  clearListener(client, sessionId)
  // Chromium requires highlightConfig even when mode is none.
  await bestEffortSend(
    client,
    'Overlay.setInspectMode',
    {
      mode: 'none',
      highlightConfig: {
        borderColor: { ...INSPECT_HIGHLIGHT.borderColor },
        contentColor: { ...INSPECT_HIGHLIGHT.contentColor },
        showInfo: false,
      },
    },
    sessionId,
  )
  await bestEffortSend(client, 'Overlay.hideHighlight', {}, sessionId)
  await bestEffortSend(client, 'Overlay.disable', {}, sessionId)
}
