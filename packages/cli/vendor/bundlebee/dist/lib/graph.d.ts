import URL from 'bare-url';
import type { PublishOptions, ReleaseGraph } from './types';
export declare function collectGraph(root: URL, entry: string, options: PublishOptions): Promise<ReleaseGraph>;
