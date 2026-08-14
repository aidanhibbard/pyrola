import { unregisterCefSession } from '@/services/browser/registry'
import { browserCefDestroy } from '@/services/pyrola/pyrola-tauri/browser'

const destroyCefSession = async (sessionId: string): Promise<void> => {
  unregisterCefSession(sessionId)
  await browserCefDestroy(sessionId)
}

export default destroyCefSession
