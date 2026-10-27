import type HyperDB from 'hyperdb';
import type { QvacAgent, QvacPublicSeed } from '../../../spec/mesh/hyperschema/types.d.ts';
export declare function readPublicSeed(tx: HyperDB, memberId: Buffer, deviceId: Buffer): Promise<QvacPublicSeed | null>;
export declare function liveAgentsOn(tx: HyperDB, providerDeviceId: Buffer): Promise<QvacAgent[]>;
export declare function hostsLiveAgent(tx: HyperDB, deviceId: Buffer): Promise<boolean>;
export declare function dropMemberSeeds(tx: HyperDB, memberId: Buffer): Promise<void>;
export declare function dropDeviceSeeds(tx: HyperDB, deviceId: Buffer): Promise<void>;
export declare function usesAny(tx: HyperDB, agents: QvacAgent[], userId: Buffer): Promise<boolean>;
export declare function pruneHostSeeds(tx: HyperDB, deviceId: Buffer): Promise<void>;
