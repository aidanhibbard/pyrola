import { takeScreenshot } from '@/services/browser/cdp-ops'
import saveScreenshot from '@/services/browser/screenshot-store'
import type CdpClient from '@/services/browser/cdp-client'
import type { ToolImagePart } from '@/types/harness/tool-image-part'

const attachScreenshotAfterwards = async (
  client: CdpClient,
  sessionId: string,
  enabled: boolean | undefined,
  options?: {
    fullPage?: boolean
    ref?: string
    type?: 'png' | 'jpeg'
  },
): Promise<ToolImagePart[] | undefined> => {
  if (!enabled) {
    return undefined
  }
  const shot = await takeScreenshot(client, sessionId, options)
  const imagePart = await saveScreenshot(shot.data, shot.mimeType)
  return [imagePart]
}

export default attachScreenshotAfterwards
