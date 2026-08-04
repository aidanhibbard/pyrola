export type ToolImagePart = {
  mimeType: string
  path: string
}

export type ToolResultWithImageParts = {
  imageParts?: ToolImagePart[]
  [key: string]: unknown
}
