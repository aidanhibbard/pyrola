/**
 * CDP method gate for browser_cdp.
 *
 * Denies methods that are real footguns or that bypass the dedicated
 * browser_* tools. Allows inspection, DOM, CSS, runtime, profiling,
 * and log methods.
 *
 * No origin allowlist. Navigate anywhere; approvals and locks are
 * the user-facing controls.
 */

const DENIED_PREFIXES = [
  // Use browser_click/type/press_key/scroll/drag instead.
  // Input.* can miss the page and hit the wrong surface.
  'Input.',
  // Cookie/localStorage/IndexedDB dump APIs.
  'Storage.',
  // Target lifecycle (create/close/attach) is via browser_tabs.
  // Target.getTargets is read-only and explicitly allowed below.
  'Target.',
  // Device emulation that can spoof state.
  'Emulation.',
] as const

const DENIED_EXACT = new Set<string>([
  'Network.setCookie', // Use browser_navigate, not raw cookie writes.
  'Network.setCookies',
  'Network.clearBrowserCache',
  'Network.deleteCookies',
  'Network.setCacheDisabled',
  'Page.navigate', // Use browser_navigate.
  'Page.navigateBack',
  'Page.navigateForward',
  'Page.navigateIntoHistory',
  'Page.resetNavigationHistory',
  'Page.setDownloadBehavior', // Downloads are not exposed.
  'Page.handleJavaScriptDialog', // Use browser tools, not raw dialog control.
  'Browser.grantPermissions', // No auto-grant of camera/mic/geolocation.
  'Browser.resetPermissions',
  'Emulation.setDeviceMetricsOverride',
  'Emulation.setUserAgentOverride', // UA is managed by the host service.
  'Security.setIgnoreCertificateErrors', // No cert error bypass.
])

/**
 * Documented intended surface for browser_cdp (deny rules still win).
 * Kept as an explicit set so reviewers can see what we expect agents to use.
 */
const ALLOWED_PREFIXES = [
  'Runtime.',
  'DOM.',
  'CSS.',
  'Page.', // except the denied Page.* navigation/download methods above
  'Network.', // except cookie/cache methods above
  'Profiler.',
  'Log.',
  'Accessibility.',
  'Overlay.',
  'Performance.',
  'HeapProfiler.',
  'Tracing.',
] as const

const isCdpMethodDenied = (method: string): boolean => {
  if (DENIED_EXACT.has(method)) {
    return true
  }
  for (const prefix of DENIED_PREFIXES) {
    if (method.startsWith(prefix)) {
      // Read-only target inventory; allowed for diagnostics / tab tooling.
      if (method === 'Target.getTargets') {
        return false
      }
      return true
    }
  }
  // Denylist gate: methods outside ALLOWED_PREFIXES are still allowed unless
  // denied above. ALLOWED_PREFIXES documents the intended inspection surface.
  for (const prefix of ALLOWED_PREFIXES) {
    if (method.startsWith(prefix)) {
      return false
    }
  }
  return false
}

export default isCdpMethodDenied
