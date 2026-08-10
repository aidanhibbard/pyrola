export type HostUserAgentBrand = {
  brand: string
  version: string
}

export type HostUserAgentData = {
  brands: HostUserAgentBrand[]
  platform: string
  mobile: boolean
}
