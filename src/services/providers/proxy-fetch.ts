import { Channel, invoke } from '@tauri-apps/api/core'
import { httpProxyRequest, isTauri } from '@/services/pyrola/pyrola-tauri'

type HttpProxyStreamEvent =
  | { kind: 'headers'; status: number; headers: Record<string, string> }
  | { kind: 'chunk'; bytes: number[] }
  | { kind: 'end' }
  | { kind: 'error'; message: string }

const toHeaderRecord = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) {
    return {}
  }
  const record: Record<string, string> = {}
  const parsed = new Headers(headers)
  parsed.forEach((value, key) => {
    record[key] = value
  })
  return record
}

const shouldStreamRequest = (method: string, body?: string): boolean => {
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') {
    return false
  }
  if (!body) {
    return false
  }
  return body.includes('"stream":true') || body.includes('"stream": true')
}

const streamProxyFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const method = init?.method ?? 'GET'
  const headers = toHeaderRecord(init?.headers)
  const body =
    init?.body === undefined || init?.body === null
      ? undefined
      : typeof init.body === 'string'
        ? init.body
        : await new Response(init.body).text()

  let status = 0
  let responseHeaders = new Headers()
  let resolveHeaders: (() => void) | null = null
  const headersReady = new Promise<void>((resolve) => {
    resolveHeaders = resolve
  })

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const channel = new Channel<HttpProxyStreamEvent>()
      channel.onmessage = (event) => {
        if (event.kind === 'headers') {
          status = event.status
          responseHeaders = new Headers(event.headers)
          resolveHeaders?.()
          return
        }
        if (event.kind === 'chunk') {
          controller.enqueue(Uint8Array.from(event.bytes))
          return
        }
        if (event.kind === 'end') {
          controller.close()
          return
        }
        if (event.kind === 'error') {
          controller.error(new Error(event.message))
        }
      }

      invoke('http_proxy_stream', {
        request: { url, method, headers, body },
        onEvent: channel,
      }).catch((error: unknown) => {
        controller.error(error instanceof Error ? error : new Error(String(error)))
      })
    },
  })

  await headersReady
  return new Response(stream, {
    status,
    statusText: status >= 400 ? 'Error' : 'OK',
    headers: responseHeaders,
  })
}

const bufferedProxyFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const method = init?.method ?? 'GET'
  const headers = toHeaderRecord(init?.headers)
  const body =
    init?.body === undefined || init?.body === null
      ? undefined
      : typeof init.body === 'string'
        ? init.body
        : await new Response(init.body).text()

  const result = await httpProxyRequest({
    url,
    method,
    headers,
    body,
  })

  const responseHeaders = new Headers(result.headers)
  if (!responseHeaders.has('content-type')) {
    const isSse = result.body.includes('data: ') && result.body.includes('\n\n')
    responseHeaders.set(
      'content-type',
      isSse ? 'text/event-stream; charset=utf-8' : 'application/json; charset=utf-8',
    )
  }

  return new Response(result.body, {
    status: result.status,
    statusText: result.status >= 400 ? 'Error' : 'OK',
    headers: responseHeaders,
  })
}

const proxyFetch: typeof fetch = async (input, init) => {
  const method = init?.method ?? 'GET'
  const body =
    init?.body === undefined || init?.body === null
      ? undefined
      : typeof init.body === 'string'
        ? init.body
        : await new Response(init.body).text()

  if (shouldStreamRequest(method, body)) {
    return streamProxyFetch(input, init)
  }

  return bufferedProxyFetch(input, init)
}

export default (): typeof fetch => (isTauri() ? proxyFetch : fetch)
