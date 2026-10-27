import Base from './dist/index'
declare class Bundlebee extends Base {}
declare namespace Bundlebee {
  type HeadInfo = import('./dist/lib/types').HeadInfo
  type BundlebeeOptions = import('./dist/lib/types').BundlebeeOptions
  type Entry = import('./dist/lib/types').Entry
  type ListedEntry = import('./dist/lib/types').ListedEntry
  type Manifest = import('./dist/lib/types').Manifest
  type ABIRecord = import('./dist/lib/types').ABIRecord
  type AddOptions = import('./dist/lib/types').AddOptions
  type LoadOptions = import('./dist/lib/types').LoadOptions
  type BundleInput = import('./dist/lib/types').BundleInput
  type ReleasePin = import('./dist/lib/types').ReleasePin
  type Signal = import('./dist/lib/types').Signal
  type OperationOptions = import('./dist/lib/types').OperationOptions
  type ReleaseQuery = import('./dist/lib/types').ReleaseQuery
  type HostRequirement = import('./dist/lib/types').HostRequirement
  type HostProvider = import('./dist/lib/types').HostProvider
  type ReleaseAsset = import('./dist/lib/types').ReleaseAsset
  type PublishOptions = import('./dist/lib/types').PublishOptions
  type Platform = import('./dist/lib/types').Platform
  type ReleaseLoadOptions = import('./dist/lib/types').ReleaseLoadOptions
  type LoadedRelease = import('./dist/lib/types').LoadedRelease
  type Store = import('./dist/lib/types').Store
  type Core = import('./dist/lib/types').Core
  type ReplicationStream = import('./dist/lib/types').ReplicationStream
}
export = Bundlebee
