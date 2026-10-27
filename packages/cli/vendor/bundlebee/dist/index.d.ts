import Bundle from 'bare-bundle';
import ReadyResource from 'ready-resource';
import type { Store, Core, ReadTree } from './lib/storage';
import Buffer from 'bare-buffer';
import type { BundlebeeOptions, BundleInput, ReleasePin, PublishOptions, ReleaseQuery, OperationOptions, ReleaseLoadOptions, AddOptions, LoadOptions, HeadInfo, LoadedRelease, Entry as EntryRecord, ListedEntry, Manifest as ManifestRecord, ABIRecord } from './lib/types';
export default class Bundlebee extends ReadyResource {
    readonly offline: boolean;
    readonly store: Store;
    readonly options: BundlebeeOptions;
    private _bee;
    constructor(store: Store, options?: BundlebeeOptions);
    static validateRelease(pin: unknown): ReleasePin;
    publish(rootURL: {
        readonly href: string;
    }, entry: string, options: PublishOptions): Promise<ReleasePin>;
    resolve(query: ReleaseQuery): Promise<ReleasePin>;
    prefetch(pin: ReleasePin, options?: OperationOptions): Promise<ReleasePin>;
    loadRelease(pin: ReleasePin, options?: ReleaseLoadOptions): Promise<LoadedRelease>;
    update(options?: OperationOptions): Promise<boolean>;
    private get tree();
    static require(store: Store, ...inputs: Array<string | BundleInput | BundlebeeOptions>): Promise<Bundlebee>;
    static bundleFrom(f: string): Bundle;
    get core(): Core;
    head(): HeadInfo;
    get key(): Buffer;
    get discoveryKey(): Buffer;
    _open(): Promise<void>;
    _close(): Promise<void>;
    createEntryStream(checkout?: HeadInfo): AsyncGenerator<ListedEntry>;
    manifest(checkout?: HeadInfo): Promise<ManifestRecord | null>;
    peerDependencies(checkout?: HeadInfo): Promise<Set<string> | null>;
    get(key: string, checkout?: HeadInfo): Promise<EntryRecord | null>;
    findABI(abi: number): Promise<HeadInfo | null>;
    allABIs(): AsyncGenerator<ABIRecord>;
    checkout(checkout?: HeadInfo): Promise<ReadTree>;
    load(rootURL: {
        readonly href: string;
    }, entry: string, checkout?: HeadInfo, { cache, skipModules, map }?: LoadOptions): Promise<LoadedRelease>;
    add(rootURL: {
        readonly href: string;
    }, entry: string, { skipModules, peerDependencies, abi, dryRun, source, pre }?: AddOptions): Promise<Bundle>;
    _addBundle(data: {
        bundle: Bundle;
        abi?: number;
    }, { peerDependencies, pre }?: Pick<AddOptions, 'peerDependencies' | 'pre'>): Promise<void>;
}
