type CdpRequest = {
  id: number
  method: string
  params?: Record<string, unknown>
  sessionId?: string
}

type CdpResponse = {
  id?: number
  method?: string
  params?: unknown
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
  sessionId?: string
}

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer?: ReturnType<typeof setTimeout>
}

const SEND_TIMEOUT_MS = 20_000
const CONNECT_TIMEOUT_MS = 5_000

type CdpEventHandler = (params: unknown, sessionId?: string) => void

const openWebSocket = (url: string): Promise<WebSocket> =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const timer = setTimeout(() => {
      cleanup()
      if (
        ws.readyState === WebSocket.CONNECTING
        || ws.readyState === WebSocket.OPEN
      ) {
        ws.close()
      }
      reject(
        new Error(
          `CDP WebSocket connect timed out after ${CONNECT_TIMEOUT_MS}ms: ${url}`,
        ),
      )
    }, CONNECT_TIMEOUT_MS)
    const handleOpen = (): void => {
      cleanup()
      resolve(ws)
    }
    const handleError = (): void => {
      cleanup()
      reject(new Error(`Failed to open CDP WebSocket: ${url}`))
    }
    const cleanup = (): void => {
      clearTimeout(timer)
      ws.removeEventListener('open', handleOpen)
      ws.removeEventListener('error', handleError)
    }
    ws.addEventListener('open', handleOpen)
    ws.addEventListener('error', handleError)
  })

export default class CdpClient {
  private nextId = 1
  private readonly pending = new Map<number, PendingRequest>()
  private readonly listeners = new Map<string, Set<CdpEventHandler>>()
  private closed = false

  private constructor(private readonly ws: WebSocket) {
    this.ws.addEventListener('message', this.handleMessage)
    this.ws.addEventListener('close', this.handleClose)
    this.ws.addEventListener('error', this.handleSocketError)
  }

  static async connectWsUrl(wsUrl: string): Promise<CdpClient> {
    const ws = await openWebSocket(wsUrl)
    return new CdpClient(ws)
  }

  static fromWebSocket(ws: WebSocket): CdpClient {
    return new CdpClient(ws)
  }

  send = (
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string,
  ): Promise<unknown> => {
    if (this.closed || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('CDP WebSocket is not open'))
    }

    const id = this.nextId
    this.nextId += 1

    const request: CdpRequest = { id, method }
    if (params !== undefined) {
      request.params = params
    }
    // Page-target CEF sockets omit sessionId; empty string means "none".
    if (sessionId !== undefined && sessionId.length > 0) {
      request.sessionId = sessionId
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) {
          reject(new Error(`CDP ${method} timed out after ${SEND_TIMEOUT_MS}ms`))
        }
      }, SEND_TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
      try {
        this.ws.send(JSON.stringify(request))
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(error instanceof Error ? error : new Error('Failed to send CDP request'))
      }
    })
  }

  attachToTarget = async (
    targetId: string,
    flatten = true,
  ): Promise<{ sessionId: string }> => {
    const result = (await this.send('Target.attachToTarget', {
      targetId,
      flatten,
    })) as { sessionId?: string }

    if (!result.sessionId || typeof result.sessionId !== 'string') {
      throw new Error('Target.attachToTarget response missing sessionId')
    }

    return { sessionId: result.sessionId }
  }

  on = (method: string, handler: CdpEventHandler): (() => void) => {
    let set = this.listeners.get(method)
    if (!set) {
      set = new Set()
      this.listeners.set(method, set)
    }
    set.add(handler)
    return () => {
      set?.delete(handler)
      if (set && set.size === 0) {
        this.listeners.delete(method)
      }
    }
  }

  close = (): void => {
    if (this.closed) {
      return
    }
    this.closed = true
    this.rejectAllPending(new Error('CDP client closed'))
    this.ws.removeEventListener('message', this.handleMessage)
    this.ws.removeEventListener('close', this.handleClose)
    this.ws.removeEventListener('error', this.handleSocketError)
    if (
      this.ws.readyState === WebSocket.OPEN ||
      this.ws.readyState === WebSocket.CONNECTING
    ) {
      this.ws.close()
    }
  }

  private handleMessage = (event: MessageEvent): void => {
    if (typeof event.data !== 'string') {
      return
    }

    let message: CdpResponse
    try {
      message = JSON.parse(event.data) as CdpResponse
    } catch {
      return
    }

    if (typeof message.id === 'number') {
      const pending = this.pending.get(message.id)
      if (!pending) {
        return
      }
      this.pending.delete(message.id)
      if (pending.timer) {
        clearTimeout(pending.timer)
      }
      if (message.error) {
        pending.reject(
          new Error(`CDP error ${message.error.code}: ${message.error.message}`),
        )
        return
      }
      pending.resolve(message.result)
      return
    }

    if (typeof message.method === 'string') {
      const handlers = this.listeners.get(message.method)
      if (!handlers) {
        return
      }
      for (const handler of handlers) {
        handler(message.params, message.sessionId)
      }
    }
  }

  private handleClose = (): void => {
    this.closed = true
    this.rejectAllPending(new Error('CDP WebSocket closed'))
  }

  private handleSocketError = (): void => {
    if (this.closed) {
      return
    }
    this.rejectAllPending(new Error('CDP WebSocket error'))
  }

  private rejectAllPending = (error: Error): void => {
    for (const pending of this.pending.values()) {
      if (pending.timer) {
        clearTimeout(pending.timer)
      }
      pending.reject(error)
    }
    this.pending.clear()
  }
}
