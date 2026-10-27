import type { QvacAutobeeHead } from '../../spec/mesh/hyperschema/types.d.ts';
import type { RecoveryProof } from './mesh.ts';
export interface MeshInviteNode {
    readonly host: string;
    readonly port: number;
}
export interface MeshInvite {
    readonly baseKey: Buffer;
    readonly seed: Buffer;
    readonly fastForward: QvacAutobeeHead | null;
    readonly additionalNodes?: ReadonlyArray<MeshInviteNode>;
    readonly blindPeers?: ReadonlyArray<Buffer>;
    readonly memberInvite?: boolean;
    readonly memberId?: Buffer;
    readonly inviteNonce?: Buffer;
    readonly compute?: boolean;
    readonly recovery?: RecoveryProof;
    readonly inviterName?: string;
    readonly deviceSeed?: Buffer;
    readonly deviceProof?: Buffer;
    readonly workspace?: boolean;
    readonly workspaceName?: string;
}
export declare function encodeMeshInvite(invite: MeshInvite): string;
export declare function decodeMeshInvite(raw: string): MeshInvite | null;
