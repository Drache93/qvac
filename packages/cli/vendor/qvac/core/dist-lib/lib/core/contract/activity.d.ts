import type { AutobeeNode } from 'autobee';
import type HyperDB from 'hyperdb';
import type { HyperDBStream } from 'hyperdb';
import type { QvacDevice } from '../../../spec/mesh/hyperschema/types.d.ts';
import type { RouterContext } from './types.ts';
type RouteHandler<T> = (op: T, ctx: RouterContext) => Promise<unknown>;
export declare function trackActivity<T>(handler: RouteHandler<T>): RouteHandler<T>;
export declare function devicesByWriterKey(tx: HyperDB, writerKey: Buffer): HyperDBStream<QvacDevice>;
export declare function liveDeviceForWriter(db: HyperDB, writerKey: Buffer): Promise<QvacDevice | null>;
export declare function liveDevicesIndexed(db: HyperDB): Promise<boolean>;
export declare function backfillLiveDevices(tx: HyperDB): Promise<void>;
export interface MarkWriterRevokedOptions {
    readonly revoked: boolean;
}
export declare function markWriterRevoked(tx: HyperDB, writerKey: Buffer, opts: MarkWriterRevokedOptions): Promise<void>;
export declare function recordActivity(tx: HyperDB, node: AutobeeNode, clock: number): Promise<void>;
export {};
