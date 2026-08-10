import type CdpClient from '@/services/browser/cdp-client'
import type { HostUserAgentData } from '@/types/browser/host-user-agent-data'

const buildUserAgentMetadata = (
  userAgentData: HostUserAgentData,
): Record<string, unknown> => ({
  brands: userAgentData.brands,
  fullVersionList: userAgentData.brands,
  platform: userAgentData.platform,
  platformVersion: '',
  architecture: '',
  model: '',
  mobile: userAgentData.mobile,
  bitness: '',
})

export const applyUserAgentOverride = async (
  client: CdpClient,
  sessionId: string | undefined,
  userAgent: string,
  userAgentData?: HostUserAgentData | null,
): Promise<void> => {
  const params: Record<string, unknown> = { userAgent }
  if (userAgentData) {
    params.userAgentMetadata = buildUserAgentMetadata(userAgentData)
  }
  await client.send('Network.setUserAgentOverride', params, sessionId)
}
