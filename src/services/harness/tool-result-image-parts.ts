export const stripImageParts = (result: unknown): unknown => {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return result
  }
  const record = { ...(result as Record<string, unknown>) }
  delete record.imageParts
  return record
}
