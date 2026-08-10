import type CdpClient from '@/services/browser/cdp-client'
import { getBoundingBox } from '@/services/browser/cdp-geometry'
import type { ScreenshotResult } from '@/types/browser/screenshot-result'

type CaptureScreenshotResult = {
  data?: string
}

const decodeBase64 = (data: string): Uint8Array => {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

type ScreenshotClip = {
  x: number
  y: number
  width: number
  height: number
}

export const takeScreenshot = async (
  client: CdpClient,
  sessionId: string,
  args: {
    fullPage?: boolean
    ref?: string
    clip?: ScreenshotClip
  } = {},
): Promise<ScreenshotResult> => {
  const params: Record<string, unknown> = {
    format: 'png',
  }

  if (args.clip) {
    params.clip = {
      x: args.clip.x,
      y: args.clip.y,
      width: Math.max(args.clip.width, 1),
      height: Math.max(args.clip.height, 1),
      scale: 1,
    }
  } else if (args.ref) {
    const box = await getBoundingBox(client, sessionId, args.ref)
    if (!box) {
      throw new Error(`Unable to get bounding box for ref: ${args.ref}`)
    }
    params.clip = {
      x: box.x,
      y: box.y,
      width: Math.max(box.width, 1),
      height: Math.max(box.height, 1),
      scale: 1,
    }
  } else if (args.fullPage) {
    params.captureBeyondViewport = true
  }

  const result = (await client.send(
    'Page.captureScreenshot',
    params,
    sessionId,
  )) as CaptureScreenshotResult

  if (typeof result.data !== 'string' || result.data.length === 0) {
    throw new Error('Page.captureScreenshot response missing data')
  }

  return {
    data: decodeBase64(result.data),
    mimeType: 'image/png',
  }
}
