import type { CatalogMatch } from '@/types/models/catalog-match'

export type ResolveCatalogMatchesOptions = {
  query?: string
  provider?: string
}

export type ResolveCatalogMatchesOk = {
  matches: CatalogMatch[]
  best?: string
}

export type ResolveCatalogMatchesNeedsQuery = {
  status: 'needs_query'
  providerId: string
  count: number
  suggested?: string
}

export type ResolveCatalogMatchesError = {
  matches: []
  error: string
}

export type ResolveCatalogMatchesResult =
  | ResolveCatalogMatchesOk
  | ResolveCatalogMatchesNeedsQuery
  | ResolveCatalogMatchesError
