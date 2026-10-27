import type { AutobeeHost, AutobeeNode } from 'autobee';
import type HyperDB from 'hyperdb';
import type { LoggerInterface } from '@qvac/logging';
export interface RouterContext {
    readonly tx: HyperDB;
    readonly host: AutobeeHost;
    readonly node: AutobeeNode;
    readonly meshPublicKey: Buffer;
    readonly meshDevicePublicKey: Buffer;
    readonly log: LoggerInterface | null;
}
