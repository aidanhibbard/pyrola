import type { HostUserAgentData } from '@/types/browser/host-user-agent-data'

// The embedded CEF browser must advertise a desktop Chrome User-Agent. The
// host app's own UA is a WebKit/Safari string; using it would make sites serve
// their Safari variant. Pin a current desktop Chrome UA + UA-CH brands so
// sites render the Chrome build.
export const DESKTOP_CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export const DESKTOP_CHROME_USER_AGENT_DATA: HostUserAgentData = {
  brands: [
    { brand: 'Chromium', version: '131' },
    { brand: 'Google Chrome', version: '131' },
    { brand: 'Not?A_Brand', version: '24' },
  ],
  platform: 'macOS',
  mobile: false,
}
