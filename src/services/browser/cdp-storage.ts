import type CdpClient from '@/services/browser/cdp-client'

const BROWSING_DATA_TYPES =
  'cookies,local_storage,session_storage,indexeddb,websql,cache_storage'

export const clearCookiesForActiveOrigin = async (
  client: CdpClient,
  sessionId: string,
): Promise<void> => {
  await client.send('Network.enable', {}, sessionId)
  await client.send('Network.clearBrowserCookies', {}, sessionId)
}

export const clearCacheForActiveOrigin = async (
  client: CdpClient,
  sessionId: string,
): Promise<void> => {
  await client.send('Network.enable', {}, sessionId)
  await client.send('Network.clearBrowserCache', {}, sessionId)
}

export const clearBrowsingData = async (
  client: CdpClient,
  sessionId: string,
): Promise<void> => {
  try {
    await client.send(
      'Storage.clearDataForOrigin',
      {
        origin: '*',
        storageTypes: BROWSING_DATA_TYPES,
      },
      sessionId,
    )
  } catch {
    // Not all storage types are supported on every target.
  }
}
