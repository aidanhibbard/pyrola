import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PyrolaSettings } from '@/types/pyrola/pyrola-settings'

vi.mock('@/services/pyrola/pyrola-tauri', () => ({
  getSecret: vi.fn<() => Promise<string | null>>(async () => null),
}))

vi.mock('@/services/providers/list-provider-models', () => ({
  listProviderModels: vi.fn<() => Promise<string[]>>(async () => {
    throw new Error('live list unavailable')
  }),
}))

import listAllProviderModels from '@/services/providers/list-all-provider-models'
import { listProviderModels } from '@/services/providers/list-provider-models'

describe('listAllProviderModels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses configured custom models when live listing fails', async () => {
    const settings = {
      version: 1 as const,
      'providers.custom.kat': {
        type: 'openai-compatible' as const,
        name: 'Kat',
        baseURL: 'http://localhost:1234/v1',
        models: [
          { id: 'kat-coder-2.5', name: 'Kat Coder 2.5' },
          { id: 'kat-coder-lite' },
        ],
      },
    } satisfies PyrolaSettings

    const groups = await listAllProviderModels(settings)
    expect(listProviderModels).toHaveBeenCalled()
    expect(groups).toHaveLength(1)
    expect(groups[0]?.providerName).toBe('Kat')
    expect(groups[0]?.models).toEqual([
      { providerId: 'kat', modelId: 'kat-coder-2.5', name: 'Kat Coder 2.5' },
      { providerId: 'kat', modelId: 'kat-coder-lite' },
    ])
  })

  it('merges configured models ahead of live models', async () => {
    vi.mocked(listProviderModels).mockResolvedValueOnce(['live-model', 'kat-coder-2.5'])

    const settings = {
      version: 1 as const,
      'providers.custom.kat': {
        type: 'openai-compatible' as const,
        name: 'Kat',
        baseURL: 'http://localhost:1234/v1',
        models: [{ id: 'kat-coder-2.5', name: 'Configured' }],
      },
    } satisfies PyrolaSettings

    const groups = await listAllProviderModels(settings)
    expect(groups[0]?.models.map((model) => model.modelId)).toEqual([
      'kat-coder-2.5',
      'live-model',
    ])
    expect(groups[0]?.models[0]?.name).toBe('Configured')
  })
})
