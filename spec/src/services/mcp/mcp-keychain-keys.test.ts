import { describe, expect, it } from 'vitest'
import {
  mcpInputKey,
  mcpKnownSecretKeys,
  mcpOAuthAsInfoKey,
  mcpOAuthClientKey,
  mcpOAuthStateKey,
  mcpOAuthTokensKey,
  mcpOAuthVerifierKey,
} from '@/services/mcp/mcp-keychain-keys'

describe('mcp-keychain-keys', () => {
  it('formats oauth and input keychain keys', () => {
    expect(mcpOAuthTokensKey('github')).toBe('pyrola:mcp:github:oauth:tokens')
    expect(mcpOAuthVerifierKey('github')).toBe('pyrola:mcp:github:oauth:verifier')
    expect(mcpOAuthClientKey('github')).toBe('pyrola:mcp:github:oauth:client')
    expect(mcpOAuthStateKey('github')).toBe('pyrola:mcp:github:oauth:state')
    expect(mcpOAuthAsInfoKey('github')).toBe('pyrola:mcp:github:oauth:as')
    expect(mcpInputKey('github', 'token')).toBe('pyrola:mcp:github:input:token')
  })

  it('lists known secret keys including inputs', () => {
    expect(mcpKnownSecretKeys('linear')).toEqual([
      'pyrola:mcp:linear:oauth:tokens',
      'pyrola:mcp:linear:oauth:verifier',
      'pyrola:mcp:linear:oauth:client',
      'pyrola:mcp:linear:oauth:state',
      'pyrola:mcp:linear:oauth:as',
    ])

    expect(mcpKnownSecretKeys('linear', ['apiKey', 'org'])).toEqual([
      'pyrola:mcp:linear:oauth:tokens',
      'pyrola:mcp:linear:oauth:verifier',
      'pyrola:mcp:linear:oauth:client',
      'pyrola:mcp:linear:oauth:state',
      'pyrola:mcp:linear:oauth:as',
      'pyrola:mcp:linear:input:apiKey',
      'pyrola:mcp:linear:input:org',
    ])
  })
})
