import b4a from 'b4a';
import { CHATS, CHAT_GROUPS, PROJECTS } from './collections.js';
import { UNGROUPED } from './contract/projects.js';
import { isRecord } from '../guards.js';
export const GROUPS_PENDING = 'groups';
export const FOLD_PENDING = 'agents';
export function upgradeCheckedKey(meshKey) {
    return `workspace-upgrade/${b4a.toHex(meshKey)}`;
}
export function agentsFoldKey(workspaceKey) {
    return `workspace-agents/${b4a.toHex(workspaceKey)}`;
}
export function groupRecordKey(workspaceKey, groupId) {
    return `workspace-upgrade/${b4a.toHex(workspaceKey)}/${groupId}`;
}
export function isGroupRecord(value) {
    return isRecord(value) && (value.key === undefined || typeof value.key === 'string');
}
export async function liveGroups(view) {
    const groups = await view.find(CHAT_GROUPS).toArray();
    return groups.filter((group) => !group.deletedAt && group.id !== UNGROUPED);
}
export async function projectsByGroup(view) {
    const rows = new Map();
    for await (const row of view.find(PROJECTS)) {
        if (row.groupId && !rows.has(row.groupId)) {
            rows.set(row.groupId, row);
        }
    }
    return rows;
}
export async function groupBuckets(view, workspaceName) {
    const live = await liveGroups(view);
    const chats = new Map(live.map((group) => [group.id, new Set()]));
    const ungrouped = new Set();
    for (const chat of await view.find(CHATS).toArray()) {
        if (chat.deletedAt)
            continue;
        const bucket = chats.get(chat.groupId ?? '') ?? ungrouped;
        bucket.add(chat.id);
    }
    const buckets = live.map((group) => ({
        groupId: group.id,
        name: group.name,
        chats: chats.get(group.id) ?? new Set()
    }));
    return ungrouped.size > 0
        ? [...buckets, { groupId: UNGROUPED, name: workspaceName, chats: ungrouped }]
        : buckets;
}
