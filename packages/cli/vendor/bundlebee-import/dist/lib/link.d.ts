import type { ReleaseQuery } from 'bundlebee/types';
import type { ResolveOptions } from './options';
interface ReleaseLink {
    readonly key: string;
    readonly selector: ReleaseQuery;
    readonly length: number | null;
    readonly entry: string | null;
}
export declare function parseLink(link: string, options: ResolveOptions): ReleaseLink;
export {};
