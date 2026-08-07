export default (path: string): string => {
  const segments = path.split(/[/\\]/).filter((segment) => segment.length > 0)
  return segments[segments.length - 1] ?? path
}
