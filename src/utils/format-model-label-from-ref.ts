import parseModelRef from '@/utils/parse-model-ref'
import formatModelRefLabel from '@/utils/format-model-ref-label'

export default (modelRef: string | undefined): string => {
  if (!modelRef?.trim()) {
    return ''
  }
  const parsed = parseModelRef(modelRef)
  if (!parsed) {
    return modelRef
  }
  return formatModelRefLabel(parsed)
}
