import type { UIMessage } from 'ai'

export type LocalChatTransportOptions = {
  send: (message: { text: string }) => Promise<void>
  stop: () => void
}

export default (options: LocalChatTransportOptions) => ({
  send: options.send,
  stop: options.stop,
})

export type LocalChatMessage = UIMessage
