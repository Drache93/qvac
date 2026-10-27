import type { LoggerInterface } from '@qvac/logging';
import type { AssistantAccount, AssistantArchivedMeshContents, AssistantArchivedMeshList, AssistantArchivedMeshMigration, AssistantMeshList, AssistantMeshStatus } from '../../spec/hyperschema/types.d.ts';
import type { CapabilityHandlers } from '../../spec/capabilities.d.ts';
export interface MeshInviteResult {
    readonly invite?: string;
    readonly meshId?: string;
    readonly notice?: string;
}
export interface MeshStatusSource {
    watch(listener: () => void): void;
    unwatch(listener: () => void): void;
    snapshot(): AssistantMeshStatus;
    leave(meshId: string): Promise<void>;
    acknowledgeKicked(): void;
    join(invite: string): Promise<void>;
    cancelJoin(): void;
    invite(member?: boolean, meshId?: string): Promise<MeshInviteResult>;
    preview(invite: string): {
        memberInvite: boolean;
        inviterName?: string;
        workspaceName?: string;
    };
    list(): Promise<AssistantMeshList>;
    account(): Promise<AssistantAccount>;
    open(meshId: string): Promise<void>;
    close(meshId: string): Promise<void>;
    label(meshId: string, label: string): Promise<void>;
    name(meshId: string, name: string): Promise<void>;
    createMesh(opts?: {
        compute?: boolean;
    }): Promise<string>;
    createWorkspace(opts?: {
        name?: string;
        icon?: string;
    }): Promise<string>;
    leaveWorkspace(meshId: string): Promise<void>;
    createProject(workspaceId: string, opts: {
        name: string;
    }): Promise<string>;
    listArchived(): Promise<AssistantArchivedMeshList>;
    archivedContents(meshId: string): Promise<AssistantArchivedMeshContents>;
    migrateArchived(meshId: string): Promise<AssistantArchivedMeshMigration>;
    recoverable(): Promise<boolean>;
    publishRecovery(phrase: string): Promise<void>;
    recover(phrase: string, timeout?: number): Promise<void>;
    displayName(): Promise<string | null>;
}
export declare function createMeshApi(status: MeshStatusSource, updateMember: CapabilityHandlers['updateMember'], log: LoggerInterface | null): Pick<CapabilityHandlers, 'meshStatusWatch' | 'listMeshes' | 'meshesWatch' | 'account' | 'accountWatch' | 'openMesh' | 'closeMesh' | 'leaveMesh' | 'acknowledgeKicked' | 'joinMesh' | 'cancelMeshJoin' | 'meshInvite' | 'previewMeshInvite' | 'setMeshLabel' | 'setMeshName' | 'createMesh' | 'createRoom' | 'listArchivedMeshes' | 'archivedMeshContents' | 'migrateArchivedMesh' | 'accountRecoverable' | 'recoveryPublish' | 'recoverAccount' | 'displayName' | 'setDisplayName'>;
