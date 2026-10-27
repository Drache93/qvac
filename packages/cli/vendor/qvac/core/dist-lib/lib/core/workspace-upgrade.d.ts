import type HyperDB from 'hyperdb';
import type { QvacChatGroup, QvacProject } from '../../spec/mesh/hyperschema/types.d.ts';
export declare const GROUPS_PENDING = "groups";
export declare const FOLD_PENDING = "agents";
export declare function upgradeCheckedKey(meshKey: Buffer): string;
export declare function agentsFoldKey(workspaceKey: Buffer): string;
export declare function groupRecordKey(workspaceKey: Buffer, groupId: string): string;
export interface GroupRecord {
    readonly key?: string;
    readonly copied?: boolean;
    readonly listedMembers?: ReadonlyArray<string>;
    readonly done?: boolean;
}
export declare function isGroupRecord(value: unknown): value is GroupRecord;
export interface Bucket {
    readonly groupId: string;
    readonly name: string;
    readonly chats: ReadonlySet<string>;
}
export declare function liveGroups(view: HyperDB): Promise<QvacChatGroup[]>;
export declare function projectsByGroup(view: HyperDB): Promise<Map<string, QvacProject>>;
export declare function groupBuckets(view: HyperDB, workspaceName: string): Promise<Bucket[]>;
