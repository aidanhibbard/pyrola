import { describe, expect, it } from 'vitest'
import deriveChatTitle, {
  isDefaultChatTitle,
  isPromptEchoTitle,
} from '@/utils/derive-chat-title'

describe('isPromptEchoTitle', () => {
  it('rejects titles that are the start of the user prompt', () => {
    expect(
      isPromptEchoTitle(
        'how do I build a script',
        'how do I build a script that can monitor an entire fleet of PCs running ubuntu?',
      ),
    ).toBe(true)
  })

  it('accepts topical labels that are not prompt prefixes', () => {
    expect(
      isPromptEchoTitle(
        'Ubuntu Fleet Monitoring',
        'how do I build a script that can monitor an entire fleet of PCs running ubuntu?',
      ),
    ).toBe(false)
  })
})

describe('deriveChatTitle', () => {
  it('keeps default title helpers', () => {
    expect(isDefaultChatTitle('New Agent')).toBe(true)
    expect(deriveChatTitle('how do I build a script that monitors fleets')).toBe(
      'how do I build a script',
    )
  })
})
