import implementation from './index.js'
declare const Import: typeof implementation
declare namespace Import {
  type Store = import('./index.js').Store
  type ReleasePin = import('./index.js').ReleasePin
  type HostProvider = import('./index.js').HostProvider
  type Options = import('./index.js').ImportOptions
  type NetworkOptions = import('./index.js').NetworkOptions
  type ResolveOptions = import('./index.js').ResolveOptions
}
export = Import
