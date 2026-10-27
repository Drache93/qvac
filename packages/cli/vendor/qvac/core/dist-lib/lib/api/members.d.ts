import type { LoggerInterface } from '@qvac/logging';
import type { AssistantAccount } from '../../spec/hyperschema/types.d.ts';
import type { openLocalStore } from '../core/local/index.ts';
import type { Mesh } from '../core/mesh.ts';
import { type MeshPool } from './current-mesh.ts';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
type LocalStore = Awaited<ReturnType<typeof openLocalStore>>;
export interface OwnMember {
    account(): Promise<AssistantAccount>;
}
export declare function requireOurMember(mesh: Mesh): Promise<Buffer>;
export declare function requireWorkspace(mesh: Mesh, meshId: string): void;
export declare function requireOurAdmin(mesh: Mesh, action: string): Promise<Buffer>;
export interface CreateMembersApiOptions {
    readonly state: LocalStore | null;
    readonly log: LoggerInterface | null;
}
export declare function createMembersApi(pool: MeshPool, self: OwnMember, { state, log }: CreateMembersApiOptions): Pick<CapabilityHandlers, 'listMembers' | 'membersWatch' | 'updateMember' | 'removeMember' | 'setMemberRole'>;
export {};
