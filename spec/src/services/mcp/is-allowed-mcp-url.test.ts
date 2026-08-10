import { describe, expect, it } from 'vitest'
import { isAllowedMcpUrl } from '@/services/mcp/is-allowed-mcp-url'

describe('isAllowedMcpUrl', () => {
  it('allows https urls', () => {
    expect(isAllowedMcpUrl('https://mcp.example.com/sse')).toBe(true)
    expect(isAllowedMcpUrl('https://127.0.0.1:8443/mcp')).toBe(true)
  })

  it('allows localhost http urls', () => {
    expect(isAllowedMcpUrl('http://localhost:3000/mcp')).toBe(true)
    expect(isAllowedMcpUrl('http://127.0.0.1/mcp')).toBe(true)
    expect(isAllowedMcpUrl('http://[::1]/mcp')).toBe(true)
  })

  it('rejects remote http urls', () => {
    expect(isAllowedMcpUrl('http://mcp.example.com/sse')).toBe(false)
    expect(isAllowedMcpUrl('http://192.168.1.10/mcp')).toBe(false)
  })

  it('rejects garbage and non-http(s) schemes', () => {
    expect(isAllowedMcpUrl('not a url')).toBe(false)
    expect(isAllowedMcpUrl('')).toBe(false)
    expect(isAllowedMcpUrl('ftp://localhost/mcp')).toBe(false)
    expect(isAllowedMcpUrl('file:///tmp/mcp')).toBe(false)
  })
})
