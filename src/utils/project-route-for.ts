import type { RouteLocationRaw } from 'vue-router'

export default (slug: string, section?: string): RouteLocationRaw => ({
  name: 'project' as const,
  params: { slug },
  query: section ? { section } : undefined,
})
