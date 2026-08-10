import { vi } from 'vitest'

/**
 * Mock of `@tauri-apps/api/event` exports used across tests.
 *
 * Use from a test-file mock factory:
 *
 *   import { mockTauriEvent } from '../../test-utils/mocks/tauri-event'
 *   vi.mock('@tauri-apps/api/event', () => mockTauriEvent({ ... }))
 */
export function createTauriEventMock(overrides: Record<string, unknown> = {}) {
  return {
    listen: vi.fn<(event: string, handler: unknown) => Promise<() => void>>(
      async () => () => {},
    ),
    ...overrides,
  }
}

/**
 * Alias for createTauriEventMock. Name starts with `mock` so Vitest allows
 * referencing it inside `vi.mock` factories without `vi.hoisted`.
 */
export function mockTauriEvent(overrides: Record<string, unknown> = {}) {
  return createTauriEventMock(overrides)
}
