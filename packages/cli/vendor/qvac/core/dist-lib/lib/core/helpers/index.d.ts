import type { QvacDevice, QvacSeedDefaultsOperation } from '../../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from '../mesh.ts';
export declare const DEFAULT_AGENT_NAME = "QV.AC";
export declare function buildDefaultSeed(device: Pick<QvacDevice, 'id' | 'recommendedModelName'>, blindPeerKeys: ReadonlyArray<Buffer>): QvacSeedDefaultsOperation;
export declare function isOwnRevokedRow(mesh: Mesh, device: QvacDevice): boolean;
export declare function isKickedRow(device: QvacDevice): boolean;
export declare function isOwnKickedRow(mesh: Mesh, device: QvacDevice): boolean;
