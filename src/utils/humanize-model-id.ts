/** Turn moonshotai/kimi-k3 into a short heading like "Kimi K3". */
export const humanizeModelId = (modelId: string): string => {
  const short = modelId.includes('/')
    ? modelId.slice(modelId.lastIndexOf('/') + 1)
    : modelId
  return short
    .split(/[-_]+/)
    .filter((part) => part.length > 0)
    .map((part) => {
      if (/^\d/.test(part) || part.length <= 2) {
        return part.toUpperCase()
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
    .join(' ')
}

export default humanizeModelId
