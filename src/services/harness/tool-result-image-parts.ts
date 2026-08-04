import type { JSONValue } from '@ai-sdk/provider'
import type { ToolResultOutput } from '@ai-sdk/provider-utils'
import { browserReadArtifact } from '@/services/pyrola/pyrola-tauri'
import type { ToolImagePart, ToolResultWithImageParts } from '@/types/harness/tool-image-part'

export const stripImageParts = (result: unknown): unknown => {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return result
  }
  const record = { ...(result as Record<string, unknown>) }
  delete record.imageParts
  return record
}

export const extractImageParts = (result: unknown): ToolImagePart[] => {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return []
  }
  const parts = (result as ToolResultWithImageParts).imageParts
  if (!Array.isArray(parts)) {
    return []
  }
  return parts.filter(
    (part): part is ToolImagePart =>
      !!part &&
      typeof part === 'object' &&
      typeof part.mimeType === 'string' &&
      typeof part.path === 'string',
  )
}

export const toModelOutputWithImageParts = async (args: {
  toolCallId: string
  output: unknown
  supportsVision: boolean
}): Promise<ToolResultOutput> => {
  const stripped = stripImageParts(args.output)
  const imageParts = args.supportsVision ? extractImageParts(args.output) : []

  if (imageParts.length === 0) {
    return {
      type: 'json',
      value: (stripped ?? null) as JSONValue,
    }
  }

  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'file'; data: { type: 'data'; data: string }; mediaType: string }
  > = [
    {
      type: 'text',
      text: `Screenshot from tool (toolCallId ${args.toolCallId}):\n${JSON.stringify(stripped)}`,
    },
  ]

  for (const part of imageParts) {
    try {
      const artifact = await browserReadArtifact(part.path)
      content.push({
        type: 'file',
        data: { type: 'data', data: artifact.base64 },
        mediaType: part.mimeType || artifact.mimeType || 'image/png',
      })
    } catch {
      content.push({
        type: 'text',
        text: `Failed to load screenshot at ${part.path}`,
      })
    }
  }

  return { type: 'content', value: content }
}
