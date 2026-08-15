import { afterEach, describe, expect, it, vi } from 'vitest'
import CdpClient from '@/services/browser/cdp-client'

type Listener = (event: MessageEvent | Event) => void

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readyState = FakeWebSocket.OPEN
  readonly sent: string[] = []
  private readonly listeners = new Map<string, Set<Listener>>()

  send = (data: string): void => {
    this.sent.push(data)
  }

  close = (): void => {
    this.readyState = FakeWebSocket.CLOSED
    this.emit('close', new Event('close'))
  }

  addEventListener = (type: string, listener: Listener): void => {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener = (type: string, listener: Listener): void => {
    this.listeners.get(type)?.delete(listener)
  }

  emit = (type: string, event: MessageEvent | Event): void => {
    const set = this.listeners.get(type)
    if (!set) {
      return
    }
    for (const listener of set) {
      listener(event)
    }
  }

  emitMessage = (payload: unknown): void => {
    this.emit(
      'message',
      new MessageEvent('message', { data: JSON.stringify(payload) }),
    )
  }
}

describe('cdp-client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('send assigns incrementing IDs', async () => {
    const ws = new FakeWebSocket()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const client = CdpClient.fromWebSocket(ws as unknown as WebSocket)

    const first = client.send('Runtime.evaluate', { expression: '1' })
    const second = client.send('Page.enable')

    expect(ws.sent).toHaveLength(2)
    expect(JSON.parse(ws.sent[0]!)).toMatchObject({ id: 1, method: 'Runtime.evaluate' })
    expect(JSON.parse(ws.sent[1]!)).toMatchObject({ id: 2, method: 'Page.enable' })

    ws.emitMessage({ id: 1, result: { result: { value: 1 } } })
    ws.emitMessage({ id: 2, result: {} })
    await expect(first).resolves.toEqual({ result: { value: 1 } })
    await expect(second).resolves.toEqual({})

    client.close()
  })

  it('response matching by ID resolves the promise', async () => {
    const ws = new FakeWebSocket()
    const client = CdpClient.fromWebSocket(ws as unknown as WebSocket)

    const pending = client.send('Target.getTargets')
    ws.emitMessage({ id: 1, result: { targetInfos: [] } })

    await expect(pending).resolves.toEqual({ targetInfos: [] })
    client.close()
  })

  it('unmatched response is ignored', async () => {
    const ws = new FakeWebSocket()
    const client = CdpClient.fromWebSocket(ws as unknown as WebSocket)

    const pending = client.send('Page.navigate', { url: 'https://example.com' })
    ws.emitMessage({ id: 99, result: { ignored: true } })
    ws.emitMessage({ id: 1, result: { frameId: 'frame-1' } })

    await expect(pending).resolves.toEqual({ frameId: 'frame-1' })
    client.close()
  })

  it('notification without id emits event', async () => {
    const ws = new FakeWebSocket()
    const client = CdpClient.fromWebSocket(ws as unknown as WebSocket)

    const events: Array<{ params: unknown; sessionId?: string }> = []
    client.on('Target.attachedToTarget', (params, sessionId) => {
      events.push({ params, sessionId })
    })

    ws.emitMessage({
      method: 'Target.attachedToTarget',
      params: { sessionId: 'sess-1', targetInfo: { targetId: 't1' } },
      sessionId: 'sess-1',
    })

    expect(events).toEqual([
      {
        params: { sessionId: 'sess-1', targetInfo: { targetId: 't1' } },
        sessionId: 'sess-1',
      },
    ])
    client.close()
  })

  it('connectWsUrl times out if the socket never opens', async () => {
    vi.useFakeTimers()
    class ConnectingWebSocket {
      static readonly CONNECTING = 0
      static readonly OPEN = 1
      static readonly CLOSING = 2
      static readonly CLOSED = 3

      readyState = ConnectingWebSocket.CONNECTING

      close = (): void => {
        this.readyState = ConnectingWebSocket.CLOSED
      }

      addEventListener = (): void => {}

      removeEventListener = (): void => {}
    }
    vi.stubGlobal('WebSocket', ConnectingWebSocket)

    const pending = CdpClient.connectWsUrl('ws://127.0.0.1:9333/devtools/page/1')
    await Promise.all([
      expect(pending).rejects.toThrow(
        /CDP WebSocket connect timed out after 5000ms/,
      ),
      vi.advanceTimersByTimeAsync(5_000),
    ])
  })
})
