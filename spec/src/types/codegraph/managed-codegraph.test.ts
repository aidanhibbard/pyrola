import { describe, expect, it } from 'vitest'
import { buildCodegraphServer } from '@/types/codegraph/managed-codegraph'

describe('buildCodegraphServer', () => {
  it('passes --path as the project root and omits NODE_OPTIONS', () => {
    const server = buildCodegraphServer('/Users/aidan/src/app')

    expect(server.args).toEqual([
      '-y',
      '@colbymchenry/codegraph',
      'serve',
      '--mcp',
      '--path',
      '/Users/aidan/src/app',
    ])
    expect(server.env?.NODE_OPTIONS).toBeUndefined()
    expect(Object.keys(server.env ?? {})).not.toContain('NODE_OPTIONS')
  })
})
