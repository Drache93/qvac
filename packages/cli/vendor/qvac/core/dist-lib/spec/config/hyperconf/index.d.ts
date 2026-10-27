import type { Codec } from 'compact-encoding'

export interface ConfConfig {
  minSupportedVersion: string
}

declare const spec: {
  production: ConfConfig
  // never set: the reader always asks for the production slot
  development: null
  productionEncoding: Codec<ConfConfig>
  developmentEncoding: null
}

export default spec
