const observeDocumentTheme = (onThemeChange: () => void): (() => void) => {
  if (typeof document === 'undefined') {
    return () => {}
  }

  const observer = new MutationObserver(() => {
    onThemeChange()
  })

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  return () => {
    observer.disconnect()
  }
}

export default observeDocumentTheme
