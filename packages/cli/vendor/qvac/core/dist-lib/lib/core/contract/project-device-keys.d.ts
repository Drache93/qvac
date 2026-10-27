import type HyperDB from 'hyperdb';
import type { QvacProjectDeviceKey } from '../../../spec/mesh/hyperschema/types.d.ts';
export declare function readProjectDeviceKey(tx: HyperDB, projectId: Buffer, deviceId: Buffer): Promise<QvacProjectDeviceKey | null>;
export declare function dropProjectDeviceKeys(tx: HyperDB, projectId: Buffer): Promise<void>;
export declare function dropListingDeviceKeys(tx: HyperDB, projectId: Buffer, memberId: Buffer): Promise<void>;
export declare function dropMemberDeviceKeys(tx: HyperDB, memberId: Buffer): Promise<void>;
export declare function dropDeviceKeysOf(tx: HyperDB, deviceId: Buffer): Promise<void>;
