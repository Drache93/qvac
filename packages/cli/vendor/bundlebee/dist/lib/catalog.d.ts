import type Bee from 'hyperbee2';
import type { ReleaseGraph, ReleasePin, ReleaseQuery, ReleaseContents, OperationOptions } from './types';
export declare function publishRelease(tree: Bee, graph: ReleaseGraph): Promise<ReleasePin>;
export declare function resolveRelease(bee: Bee, query: ReleaseQuery): Promise<ReleasePin>;
export declare function readRelease(bee: Bee, pin: ReleasePin, options: OperationOptions): Promise<ReleaseContents>;
