import { describe, expect, it } from 'vitest'
import isCdpMethodDenied from '@/services/harness/browser/is-cdp-method-denied'

describe('isCdpMethodDenied', () => {
  it('denies Input.* methods', () => {
    expect(isCdpMethodDenied('Input.dispatchMouseEvent')).toBe(true)
    expect(isCdpMethodDenied('Input.dispatchKeyEvent')).toBe(true)
    expect(isCdpMethodDenied('Input.insertText')).toBe(true)
  })

  it('denies Storage.* methods', () => {
    expect(isCdpMethodDenied('Storage.getCookies')).toBe(true)
    expect(isCdpMethodDenied('Storage.setCookies')).toBe(true)
    expect(isCdpMethodDenied('Storage.clearDataForOrigin')).toBe(true)
  })

  it('denies Network cookie and cache methods', () => {
    expect(isCdpMethodDenied('Network.setCookie')).toBe(true)
    expect(isCdpMethodDenied('Network.setCookies')).toBe(true)
    expect(isCdpMethodDenied('Network.deleteCookies')).toBe(true)
    expect(isCdpMethodDenied('Network.clearBrowserCache')).toBe(true)
  })

  it('denies Page navigation and download methods', () => {
    expect(isCdpMethodDenied('Page.navigate')).toBe(true)
    expect(isCdpMethodDenied('Page.navigateBack')).toBe(true)
    expect(isCdpMethodDenied('Page.navigateForward')).toBe(true)
    expect(isCdpMethodDenied('Page.setDownloadBehavior')).toBe(true)
  })

  it('denies Target lifecycle methods', () => {
    expect(isCdpMethodDenied('Target.createTarget')).toBe(true)
    expect(isCdpMethodDenied('Target.closeTarget')).toBe(true)
    expect(isCdpMethodDenied('Target.attachToTarget')).toBe(true)
  })

  it('allows Target.getTargets (read-only)', () => {
    expect(isCdpMethodDenied('Target.getTargets')).toBe(false)
  })

  it('denies Emulation device and UA overrides', () => {
    expect(isCdpMethodDenied('Emulation.setDeviceMetricsOverride')).toBe(true)
    expect(isCdpMethodDenied('Emulation.setUserAgentOverride')).toBe(true)
  })

  it('denies Browser permission grant/reset', () => {
    expect(isCdpMethodDenied('Browser.grantPermissions')).toBe(true)
    expect(isCdpMethodDenied('Browser.resetPermissions')).toBe(true)
  })

  it('denies Security.setIgnoreCertificateErrors', () => {
    expect(isCdpMethodDenied('Security.setIgnoreCertificateErrors')).toBe(true)
  })

  it('allows inspection and profiling methods', () => {
    const allowed = [
      'Runtime.evaluate',
      'Runtime.enable',
      'DOM.getDocument',
      'DOM.resolveNode',
      'CSS.getComputedStyleForNode',
      'Page.captureScreenshot',
      'Page.getFrameTree',
      'Page.getNavigationHistory',
      'Network.enable',
      'Network.getResponseBody',
      'Profiler.start',
      'Profiler.stop',
      'Log.enable',
      'Log.entryAdded',
      'Accessibility.getFullAXTree',
      'Overlay.highlightNode',
      'Overlay.hideHighlight',
      'Performance.getMetrics',
    ]
    for (const method of allowed) {
      expect(isCdpMethodDenied(method)).toBe(false)
    }
  })
})
