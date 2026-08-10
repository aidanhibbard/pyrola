import { ref, type Ref } from 'vue'
import { toast } from 'vue-sonner'

type ToolbarArgs = {
  cefReady: Ref<boolean>
  currentUrl: Ref<string>
  reload: () => Promise<void>
}

export default (args: ToolbarArgs) => {
  const historyUrls = ref<string[]>([])

  const recordHistoryUrl = (url: string): void => {
    const trimmed = url.trim()
    if (!trimmed || trimmed === 'about:blank') {
      return
    }
    historyUrls.value = [
      trimmed,
      ...historyUrls.value.filter((item) => item !== trimmed),
    ].slice(0, 50)
  }

  const refreshHistoryUrls = async (): Promise<void> => {
    // Local navigation memory only; embedded CEF has no CDP history list.
  }

  const handleTakeScreenshot = async (): Promise<void> => {
    toast.info(
      'Screenshots are available via the agent browser_take_screenshot tool',
    )
  }

  const handleHardReload = async (): Promise<void> => {
    if (!args.cefReady.value) {
      return
    }
    try {
      await args.reload()
      toast.success('Reload complete')
    } catch (error) {
      toast.error('Failed to reload', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const handleCopyUrl = async (): Promise<void> => {
    const url = args.currentUrl.value.trim()
    if (!url) {
      toast.error('No URL to copy')
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.success('URL copied')
    } catch (error) {
      toast.error('Failed to copy URL', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const handleClearBrowsingData = async (): Promise<void> => {
    toast.info(
      'Clear browsing data is not available for the embedded browser yet',
    )
  }

  const handleClearCookies = async (): Promise<void> => {
    toast.info('Clear cookies is not available for the embedded browser yet')
  }

  const handleClearCache = async (): Promise<void> => {
    toast.info('Clear cache is not available for the embedded browser yet')
  }

  return {
    historyUrls,
    recordHistoryUrl,
    refreshHistoryUrls,
    handleTakeScreenshot,
    handleHardReload,
    handleCopyUrl,
    handleClearBrowsingData,
    handleClearCookies,
    handleClearCache,
  }
}
