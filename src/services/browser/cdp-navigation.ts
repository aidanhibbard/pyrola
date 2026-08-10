import type CdpClient from '@/services/browser/cdp-client'
import type { NavigationResult } from '@/types/browser/navigation-result'

type NavigationHistoryEntry = {
  id?: number
  url?: string
  title?: string
}

type NavigationHistoryResult = {
  currentIndex?: number
  entries?: NavigationHistoryEntry[]
}

type NavigateCdpResult = {
  frameId?: string
  loaderId?: string
  errorText?: string
}

const LOAD_TIMEOUT_MS = 30_000

const waitForLoadEvent = (
  client: CdpClient,
  sessionId: string,
): { promise: Promise<void>; cancel: () => void } => {
  let unsubscribe = (): void => {}
  let settled = false
  let timeout: ReturnType<typeof setTimeout> | undefined

  const promise = new Promise<void>((resolve, reject) => {
    timeout = setTimeout(() => {
      if (settled) {
        return
      }
      settled = true
      unsubscribe()
      reject(new Error('Timed out waiting for Page.loadEventFired'))
    }, LOAD_TIMEOUT_MS)

    unsubscribe = client.on('Page.loadEventFired', (_params, eventSessionId) => {
      if (eventSessionId !== undefined && eventSessionId !== sessionId) {
        return
      }
      if (settled) {
        return
      }
      settled = true
      if (timeout !== undefined) {
        clearTimeout(timeout)
      }
      unsubscribe()
      resolve()
    })
  })

  return {
    promise,
    cancel: () => {
      if (settled) {
        return
      }
      settled = true
      if (timeout !== undefined) {
        clearTimeout(timeout)
      }
      unsubscribe()
    },
  }
}

const getNavigationHistory = async (
  client: CdpClient,
  sessionId: string,
): Promise<{ currentIndex: number; entries: NavigationHistoryEntry[] }> => {
  await client.send('Page.enable', {}, sessionId)
  const result = (await client.send(
    'Page.getNavigationHistory',
    {},
    sessionId,
  )) as NavigationHistoryResult

  const entries = Array.isArray(result.entries) ? result.entries : []
  const currentIndex =
    typeof result.currentIndex === 'number' && Number.isFinite(result.currentIndex)
      ? result.currentIndex
      : -1

  return { currentIndex, entries }
}

const navigateToHistoryEntry = async (
  client: CdpClient,
  sessionId: string,
  entryId: number,
): Promise<void> => {
  await client.send('Page.enable', {}, sessionId)
  const loadWait = waitForLoadEvent(client, sessionId)
  try {
    await client.send(
      'Page.navigateToHistoryEntry',
      { entryId },
      sessionId,
    )
    await loadWait.promise
  } catch (error) {
    loadWait.cancel()
    throw error
  }
}

export const navigate = async (
  client: CdpClient,
  sessionId: string,
  url: string,
): Promise<NavigationResult> => {
  await client.send('Page.enable', {}, sessionId)
  const loadWait = waitForLoadEvent(client, sessionId)
  try {
    const result = (await client.send(
      'Page.navigate',
      { url },
      sessionId,
    )) as NavigateCdpResult

    if (!result.frameId || typeof result.frameId !== 'string') {
      throw new Error('Page.navigate response missing frameId')
    }

    const navigation: NavigationResult = {
      frameId: result.frameId,
      loaderId: typeof result.loaderId === 'string' ? result.loaderId : '',
    }
    if (typeof result.errorText === 'string' && result.errorText.length > 0) {
      navigation.errorText = result.errorText
      loadWait.cancel()
      return navigation
    }

    await loadWait.promise
    return navigation
  } catch (error) {
    loadWait.cancel()
    throw error
  }
}

export const canGoBack = async (
  client: CdpClient,
  sessionId: string,
): Promise<boolean> => {
  const { currentIndex } = await getNavigationHistory(client, sessionId)
  return currentIndex > 0
}

export const canGoForward = async (
  client: CdpClient,
  sessionId: string,
): Promise<boolean> => {
  const { currentIndex, entries } = await getNavigationHistory(client, sessionId)
  return currentIndex >= 0 && currentIndex < entries.length - 1
}

export const goBack = async (
  client: CdpClient,
  sessionId: string,
): Promise<void> => {
  const { currentIndex, entries } = await getNavigationHistory(client, sessionId)
  const previous = currentIndex > 0 ? entries[currentIndex - 1] : undefined
  if (!previous || typeof previous.id !== 'number') {
    throw new Error('No previous navigation history entry')
  }
  await navigateToHistoryEntry(client, sessionId, previous.id)
}

export const goForward = async (
  client: CdpClient,
  sessionId: string,
): Promise<void> => {
  const { currentIndex, entries } = await getNavigationHistory(client, sessionId)
  const next =
    currentIndex >= 0 && currentIndex < entries.length - 1
      ? entries[currentIndex + 1]
      : undefined
  if (!next || typeof next.id !== 'number') {
    throw new Error('No next navigation history entry')
  }
  await navigateToHistoryEntry(client, sessionId, next.id)
}

export const reload = async (
  client: CdpClient,
  sessionId: string,
): Promise<void> => {
  await client.send('Page.enable', {}, sessionId)
  const loadWait = waitForLoadEvent(client, sessionId)
  try {
    await client.send('Page.reload', {}, sessionId)
    await loadWait.promise
  } catch (error) {
    loadWait.cancel()
    throw error
  }
}

export const hardReload = async (
  client: CdpClient,
  sessionId: string,
): Promise<void> => {
  await client.send('Page.enable', {}, sessionId)
  const loadWait = waitForLoadEvent(client, sessionId)
  try {
    await client.send('Page.reload', { ignoreCache: true }, sessionId)
    await loadWait.promise
  } catch (error) {
    loadWait.cancel()
    throw error
  }
}

export const getCurrentUrl = async (
  client: CdpClient,
  sessionId: string,
): Promise<string> => {
  const { currentIndex, entries } = await getNavigationHistory(client, sessionId)
  const entry =
    currentIndex >= 0 && currentIndex < entries.length
      ? entries[currentIndex]
      : undefined
  return typeof entry?.url === 'string' ? entry.url : ''
}

export const getNavigationHistoryUrls = async (
  client: CdpClient,
  sessionId: string,
): Promise<string[]> => {
  const { entries } = await getNavigationHistory(client, sessionId)
  return entries
    .map((entry) => (typeof entry.url === 'string' ? entry.url : ''))
    .filter((url) => url.length > 0)
}
