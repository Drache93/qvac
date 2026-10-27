import type HyperDB from 'hyperdb';
import type { QvacMeshInviteGrant } from '../../../spec/mesh/hyperschema/types.d.ts';
export declare function nextGrantSequence(tx: HyperDB): Promise<number>;
export declare function recordMemberRemoval(tx: HyperDB, memberId: Buffer): Promise<void>;
export declare function removedSinceMint(tx: HyperDB, memberId: Buffer, grant: QvacMeshInviteGrant): Promise<boolean>;
