import type HyperDB from 'hyperdb';
import type { QvacAgent, QvacProject, QvacProjectDeviceKey, QvacProjectHostKey, QvacProjectKey } from '../../spec/mesh/hyperschema/types.d.ts';
export interface ProjectSeed {
    readonly projectId: Buffer;
    readonly seed: Buffer;
}
export interface ProjectHostSeed extends ProjectSeed {
    readonly project: HyperDB;
    readonly picking?: boolean;
}
export declare function dueProjectKey(view: HyperDB, memberId: Buffer, { projectId, seed }: ProjectSeed): Promise<QvacProjectKey | null>;
export declare function dueProjectHostKey(view: HyperDB, agent: QvacAgent, seal: ProjectHostSeed): Promise<QvacProjectHostKey | null>;
export declare function dueProjectDeviceKeys(view: HyperDB, row: QvacProject, seed: Buffer): Promise<QvacProjectDeviceKey[]>;
