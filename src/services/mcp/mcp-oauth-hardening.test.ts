import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/pyrola/pyrola-tauri', () => ({
  getSecret: vi.fn<() => Promise<string | null>>(async () => null),
  setSecret: vi.fn<(key: string, value: string) => Promise<void>>(async () => {}),
  deleteSecret: vi.fn<(key: string) => Promise<void>>(async () => {}),
}))

import { createPyrolaOAuthProvider } from '@/services/mcp/pyrola-oauth-provider'
import { mcpOAuthFetch } from '@/services/mcp/mcp-oauth-fetch'

describe('pyrola oauth AS confirm', () => {
  it('requires confirmation when no allowlist and no pin', async () => {
    const confirm = vi.fn<(origin: string) => Promise<boolean>>(async () => false)
    const provider = createPyrolaOAuthProvider({
      serverId: 'demo',
      serverUrl: 'https://mcp.example',
      redirectUrl: 'http://127.0.0.1/callback',
      openUrl: async () => {},
      confirmAuthorizationServerOrigin: confirm,
    })

    await expect(
      provider.validateAuthorizationServerURL?.(
        'https://mcp.example',
        'https://auth.evil.example',
      ),
    ).rejects.toThrow(/not confirmed/)
    expect(confirm).toHaveBeenCalledWith('https://auth.evil.example')
  })
})

describe('mcpOAuthFetch', () => {
  it('blocks private https hosts', async () => {
    await expect(mcpOAuthFetch('https://10.0.0.1/token')).rejects.toThrow(/blocked/)
  })

  it('blocks non-localhost http', async () => {
    await expect(mcpOAuthFetch('http://example.com/token')).rejects.toThrow(/localhost/)
  })
})
