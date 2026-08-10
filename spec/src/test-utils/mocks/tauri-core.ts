import { vi } from 'vitest'

/**
 * Mock of `@tauri-apps/api/core` exports used across tests.
 *
 * Use from a test-file mock factory:
 *
 *   import { mockTauriCore } from '../../test-utils/mocks/tauri-core'
 *   vi.mock('@tauri-apps/api/core', () => mockTauriCore({ ... }))
 */
export function createTauriCoreMock(overrides: Record<string, unknown> = {}) {
  return {
    invoke: vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>(),
    Channel: vi.fn<() => unknown>(),
    ...overrides,
  }
}

/**
 * Alias for createTauriCoreMock. Name starts with `mock` so Vitest allows
 * referencing it inside `vi.mock` factories without `vi.hoisted`.
 */
export function mockTauriCore(overrides: Record<string, unknown> = {}) {
  return createTauriCoreMock(overrides)
}
