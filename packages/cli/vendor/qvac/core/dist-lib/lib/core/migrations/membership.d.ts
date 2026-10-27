import { type MembershipContext } from '../membership.ts';
import type { Mesh } from '../mesh.ts';
export interface MintedRoot {
    readonly publicKey: Buffer;
    readonly proof: Buffer;
}
export interface MembershipMigrationContext extends MembershipContext {
    readonly deviceName: string;
    readonly mintRoot: (deviceId: Buffer, at: number) => Promise<MintedRoot>;
}
export declare function migrateMembership(mesh: Mesh, { deviceKeyPair, deviceName, mintRoot, log }: MembershipMigrationContext): Promise<boolean>;
