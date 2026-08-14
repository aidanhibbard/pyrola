import { openBrowser } from '@/composables/workbench-store/open-tabs'
import { resolveProjectIdBySlug } from '@/composables/workbench-store/helpers'
import type { BrowserRevealPosition } from '@/types/browser/browser-reveal-position'

const ensureWorkbenchBrowser = async (args: {
  projectSlug: string
  position?: BrowserRevealPosition
}): Promise<{ ok: true } | { ok: false; error: string }> => {
  const projectId = resolveProjectIdBySlug(args.projectSlug)
  if (!projectId) {
    return { ok: false, error: `No project registered for slug "${args.projectSlug}"` }
  }

  try {
    await openBrowser(projectId, { focus: Boolean(args.position) })
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to open the workbench browser',
    }
  }
}

export default ensureWorkbenchBrowser
