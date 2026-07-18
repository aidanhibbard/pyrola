import { httpProxyRequest } from '@/services/pyrola/pyrola-tauri'

export type WebSearchResult = {
  title: string
  url: string
  snippet: string
}

type DuckDuckGoTopic = {
  Text?: string
  FirstURL?: string
}

type DuckDuckGoResponse = {
  Abstract?: string
  AbstractURL?: string
  AbstractSource?: string
  Heading?: string
  RelatedTopics?: Array<DuckDuckGoTopic | { Name?: string; Topics?: DuckDuckGoTopic[] }>
}

const collectRelatedTopics = (
  topics: DuckDuckGoResponse['RelatedTopics'],
  results: WebSearchResult[],
  limit: number,
): void => {
  if (!topics || results.length >= limit) {
    return
  }

  for (const topic of topics) {
    if (results.length >= limit) {
      return
    }

    if ('Topics' in topic && Array.isArray(topic.Topics)) {
      collectRelatedTopics(topic.Topics, results, limit)
      continue
    }

    const leaf = topic as DuckDuckGoTopic
    const text = leaf.Text?.trim()
    const url = leaf.FirstURL?.trim()
    if (!text || !url) {
      continue
    }

    const separator = text.indexOf(' - ')
    const title = separator >= 0 ? text.slice(0, separator).trim() : text
    const snippet = separator >= 0 ? text.slice(separator + 3).trim() : ''

    results.push({ title, url, snippet })
  }
}

export default async (query: string, limit = 8): Promise<{
  query: string
  results: WebSearchResult[]
}> => {
  const trimmed = query.trim()
  if (!trimmed) {
    throw new Error('Search query is required')
  }

  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(trimmed)}&format=json&no_redirect=1&no_html=1`
  const response = await httpProxyRequest({ url, method: 'GET' })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Search request failed with status ${response.status}`)
  }

  const payload = JSON.parse(response.body) as DuckDuckGoResponse
  const results: WebSearchResult[] = []

  if (payload.Abstract?.trim()) {
    results.push({
      title: payload.Heading?.trim() || payload.AbstractSource?.trim() || 'Summary',
      url: payload.AbstractURL?.trim() || `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`,
      snippet: payload.Abstract.trim(),
    })
  }

  collectRelatedTopics(payload.RelatedTopics, results, limit)

  return {
    query: trimmed,
    results: results.slice(0, limit),
  }
}
