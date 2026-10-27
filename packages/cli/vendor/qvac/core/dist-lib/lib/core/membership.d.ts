import type { KeyPair } from 'hyperswarm';
import type { LoggerInterface } from '@qvac/logging';
import type { LocalIdentity } from '../../spec/local/hyperschema/types.d.ts';
import type { QvacDevice } from '../../spec/mesh/hyperschema/types.d.ts';
import type { Mesh } from './mesh.ts';
export interface MembershipView {
    readonly members: number;
    readonly own: QvacDevice | null;
    readonly unattested: ReadonlyArray<QvacDevice>;
}
export interface MembershipContext {
    readonly deviceKeyPair: KeyPair;
    readonly log: LoggerInterface | null;
}
export declare function membershipView(mesh: Mesh, deviceId: Buffer): Promise<MembershipView>;
export interface KnownMember {
    readonly id: Buffer;
    readonly name: string;
    readonly updatedAt: number;
    readonly proof: Buffer;
}
export declare function claimOwnMembership(mesh: Mesh, { deviceKeyPair, log }: MembershipContext, known: KnownMember): Promise<void>;
export declare function namedAt(identity: Pick<LocalIdentity, 'displayNameAt'>): number;
export declare function legacyNameStamp(account: Mesh, { deviceKeyPair }: MembershipContext, identity: LocalIdentity): Promise<number | null>;
export interface RenameFoundedMemberOptions {
    readonly identity: LocalIdentity;
    readonly adopt: (name: string, namedAt: number) => Promise<unknown>;
}
export declare function renameFoundedMember(mesh: Mesh, { deviceKeyPair, log }: MembershipContext, { identity, adopt }: RenameFoundedMemberOptions): Promise<void>;
