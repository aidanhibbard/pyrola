import { setLastInteractedViewId } from '@/services/browser/registry'
import ensureWorkbenchBrowser from '@/services/harness/browser/ensure-workbench-browser'
import type { BrowserRevealPosition } from '@/types/browser/browser-reveal-position'

const revealBrowserSession = async (args: {
  projectSlug: string
  sessionId: string
  position?: BrowserRevealPosition
}): Promise<{ error?: string }> => {
  if (!args.position) {
    return {}
  }
  setLastInteractedViewId(args.projectSlug, args.sessionId)
  const opened = await ensureWorkbenchBrowser({
    projectSlug: args.projectSlug,
    position: args.position,
  })
  if (!opened.ok) {
    return { error: opened.error }
  }
  return {}
}

export default revealBrowserSession
