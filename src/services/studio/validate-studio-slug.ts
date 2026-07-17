const STUDIO_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export default (slug: string): string | null => {
  if (!slug || slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
    return 'Slug must be a single kebab-case segment with no path separators'
  }
  if (!STUDIO_SLUG_RE.test(slug)) {
    return 'Slug must use kebab-case (lowercase letters, numbers, hyphens)'
  }
  return null
}
