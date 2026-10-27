import type { Store, ReleasePin } from 'bundlebee/types';
import type { ImportOptions, NetworkOptions, ResolveOptions } from './lib/options';
export type { Store, ReleasePin, HostProvider } from 'bundlebee/types';
export type { ImportOptions, NetworkOptions, ResolveOptions } from './lib/options';
declare function importRelease(store: Store, pin: ReleasePin, options?: ImportOptions): Promise<unknown>;
declare function resolve(store: Store, link: string, options?: ResolveOptions): Promise<ReleasePin>;
declare function prepare(store: Store, pin: ReleasePin, options?: NetworkOptions): Promise<ReleasePin>;
declare const _default: typeof importRelease & {
    resolve: typeof resolve;
    prepare: typeof prepare;
};
export default _default;
