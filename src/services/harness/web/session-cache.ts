import type { WebContentKind, WebFetchFormat } from '@/types/harness/web-content'

type WebFetchCacheEntry = {
  status: number
  contentType: string
  text: string
  kind: WebContentKind
  spaShell: boolean
  challenge: boolean
}

const cache = new Map<string, WebFetchCacheEntry>()

const makeKey = (
  chatId: string,
  format: WebFetchFormat,
  url: string,
): string => `${chatId}\0${format}\0${url}`

const webFetchSessionCache = {
  makeKey,
  get: (key: string): WebFetchCacheEntry | undefined => cache.get(key),
  set: (key: string, entry: WebFetchCacheEntry): void => {
    cache.set(key, entry)
  },
  clear: (): void => {
    cache.clear()
  },
}

export default webFetchSessionCache
