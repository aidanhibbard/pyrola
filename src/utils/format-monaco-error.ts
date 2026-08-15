import formatUnknownError from '@/utils/format-unknown-error'

const TOAST_DESCRIPTION_MAX = 200

const WASM_CSP_TOAST =
  'Editor highlighting could not load (CSP blocked WebAssembly).'

const isWasmCspMessage = (message: string): boolean => {
  const lower = message.toLowerCase()
  return (
    lower.includes('content security policy') ||
    lower.includes('webassembly') ||
    lower.includes('wasm code generation') ||
    lower.includes('wasm-unsafe-eval') ||
    (lower.includes('script-src') && lower.includes('sha256'))
  )
}

const truncateToastDescription = (message: string): string => {
  if (message.length <= TOAST_DESCRIPTION_MAX) {
    return message
  }
  return `${message.slice(0, TOAST_DESCRIPTION_MAX - 3)}...`
}

export default (error: unknown): string => {
  const message = formatUnknownError(error)
  if (isWasmCspMessage(message)) {
    return WASM_CSP_TOAST
  }
  return truncateToastDescription(message)
}
