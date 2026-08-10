import type { ProviderCatalogEntry } from '@/types/providers/provider-catalog-entry'
import firstPartyAD from './first-party-a-d'
import firstPartyEO from './first-party-e-o'
import firstPartyPZ from './first-party-p-z'

export default [
  ...firstPartyAD,
  ...firstPartyEO,
  ...firstPartyPZ,
] satisfies ProviderCatalogEntry[]
