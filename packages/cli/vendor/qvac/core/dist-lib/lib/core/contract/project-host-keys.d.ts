import type HyperDB from 'hyperdb';
import type { QvacProjectHostKey } from '../../../spec/mesh/hyperschema/types.d.ts';
export declare function readProjectHostKey(tx: HyperDB, projectId: Buffer, deviceId: Buffer): Promise<QvacProjectHostKey | null>;
export declare function dropProjectHostKeys(tx: HyperDB, projectId: Buffer): Promise<void>;
export declare function dropMemberHostKeys(tx: HyperDB, projectId: Buffer, memberId: Buffer): Promise<void>;
export declare function dropDeviceHostKeys(tx: HyperDB, deviceId: Buffer): Promise<void>;
export declare function pruneProjectHostKeys(tx: HyperDB, deviceId: Buffer): Promise<void>;
