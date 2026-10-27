import type HyperDB from 'hyperdb';
import type { Router } from '../../../spec/mesh/hyperdispatch/index.js';
import type { QvacDevice, QvacMember } from '../../../spec/mesh/hyperschema/types.d.ts';
interface MemberClaim {
    readonly deviceId: Buffer;
    readonly writerKey: Buffer;
    readonly memberId: Buffer;
    readonly claim: Buffer;
}
export declare function provenMember(meshPublicKey: Buffer, { deviceId, writerKey, memberId, claim }: MemberClaim): Promise<Buffer | null>;
export declare function accountMember(tx: HyperDB): Promise<Buffer | null>;
export declare function outsideAccount(tx: HyperDB, memberId: Buffer | null | undefined): Promise<boolean>;
export interface LinkMemberOptions {
    readonly member: QvacMember;
    readonly proof: Buffer;
}
export declare function linkMember(tx: HyperDB, device: QvacDevice, { member, proof }: LinkMemberOptions): Promise<QvacMember>;
export declare function registerMemberRoutes(router: Router): void;
export {};
