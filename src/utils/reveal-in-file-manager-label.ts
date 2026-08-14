const revealInFileManagerLabel = (platform = navigator.platform): string => {
  const normalized = platform.toLowerCase()
  if (normalized.includes('mac')) {
    return 'Reveal in Finder'
  }
  if (normalized.includes('win')) {
    return 'Reveal in Explorer'
  }
  return 'Reveal in file manager'
}

export default revealInFileManagerLabel
