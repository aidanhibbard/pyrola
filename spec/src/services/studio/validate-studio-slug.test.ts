import { describe, expect, it } from 'vitest'
import validateStudioSlug from '@/services/studio/validate-studio-slug'

describe('validateStudioSlug', () => {
  it('accepts kebab-case slugs', () => {
    expect(validateStudioSlug('metrics-dashboard')).toBeNull()
    expect(validateStudioSlug('q2-2026')).toBeNull()
  })

  it('rejects invalid slugs', () => {
    expect(validateStudioSlug('../escape')).not.toBeNull()
    expect(validateStudioSlug('Bad_Slug')).not.toBeNull()
    expect(validateStudioSlug('')).not.toBeNull()
  })
})
