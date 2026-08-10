import type { ToolImagePart } from '@/types/harness/tool-image-part'
import { writeTempBytes } from '@/services/pyrola/pyrola-tauri'

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

const saveScreenshot = async (bytes: Uint8Array): Promise<ToolImagePart> => {
  const { path } = await writeTempBytes({
    contentBase64: bytesToBase64(bytes),
    kind: 'screenshots',
    extension: 'png',
  })
  return {
    mimeType: 'image/png',
    path,
  }
}

export default saveScreenshot
