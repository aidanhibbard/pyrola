import { onBeforeUnmount, ref } from 'vue'
import type CdpClient from '@/services/browser/cdp-client'

export type BrowserConsoleLine = {
  timestamp: string
  level: string
  text: string
}

type ConsoleApiCalledParams = {
  type?: string
  args?: Array<{
    type?: string
    value?: unknown
    description?: string
    unserializableValue?: string
  }>
}

type LogEntryAddedParams = {
  entry?: {
    source?: string
    level?: string
    text?: string
    timestamp?: number
  }
}

const formatArg = (arg: {
  type?: string
  value?: unknown
  description?: string
  unserializableValue?: string
}): string => {
  if (typeof arg.value === 'string') {
    return arg.value
  }
  if (typeof arg.value === 'number' || typeof arg.value === 'boolean') {
    return String(arg.value)
  }
  if (arg.value === null) {
    return 'null'
  }
  if (typeof arg.description === 'string') {
    return arg.description
  }
  if (typeof arg.unserializableValue === 'string') {
    return arg.unserializableValue
  }
  if (typeof arg.type === 'string') {
    return `[${arg.type}]`
  }
  return '[unknown]'
}

export default () => {
  const consoleOpen = ref(false)
  const lines = ref<BrowserConsoleLine[]>([])
  let unsubscribers: Array<() => void> = []
  let attachedClient: CdpClient | null = null

  const clearConsole = (): void => {
    lines.value = []
  }

  const detachConsole = (): void => {
    for (const unsub of unsubscribers) {
      unsub()
    }
    unsubscribers = []
    attachedClient = null
  }

  const attachConsole = async (
    getClient: () => Promise<CdpClient>,
  ): Promise<void> => {
    try {
      const client = await getClient()
      if (attachedClient === client) {
        return
      }
      detachConsole()
      attachedClient = client

      unsubscribers.push(
        client.on('Runtime.consoleAPICalled', (params) => {
          const payload = (params ?? {}) as ConsoleApiCalledParams
          const level = typeof payload.type === 'string' ? payload.type : 'log'
          const text = Array.isArray(payload.args)
            ? payload.args.map(formatArg).join(' ')
            : ''
          lines.value = [
            ...lines.value,
            {
              timestamp: new Date().toISOString(),
              level,
              text,
            },
          ].slice(-500)
        }),
      )

      unsubscribers.push(
        client.on('Log.entryAdded', (params) => {
          const entry = ((params ?? {}) as LogEntryAddedParams).entry ?? {}
          const level = typeof entry.level === 'string' ? entry.level : 'info'
          const text = typeof entry.text === 'string' ? entry.text : ''
          lines.value = [
            ...lines.value,
            {
              timestamp: new Date().toISOString(),
              level,
              text,
            },
          ].slice(-500)
        }),
      )

      // Page-target CDP: no flattened session id required.
      await client.send('Runtime.enable')
      await client.send('Log.enable')
    } catch (error) {
      detachConsole()
      throw error
    }
  }

  const toggleConsole = (): void => {
    consoleOpen.value = !consoleOpen.value
  }

  onBeforeUnmount(() => {
    consoleOpen.value = false
    detachConsole()
  })

  return {
    consoleOpen,
    lines,
    clearConsole,
    toggleConsole,
    attachConsole,
    detachConsole,
  }
}
