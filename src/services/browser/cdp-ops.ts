import { resetSnapshotsForTests } from './cdp-snapshot'
import { resetAttachedSessionsForTests } from './cdp-tabs'

export * from './cdp-user-agent'
export * from './cdp-navigation'
export * from './cdp-snapshot'
export * from './cdp-interact'
export * from './cdp-screenshot'
export * from './cdp-tabs'
export * from './cdp-storage'

export const resetCdpOpsForTests = (): void => {
  resetSnapshotsForTests()
  resetAttachedSessionsForTests()
}
