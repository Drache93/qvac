import b4a from 'b4a';
import crypto from 'hypercore-crypto';
import { isRecord } from '../guards.js';
import { ACTIVE_CHATS_BY_AGENT, AGENTS, CHATS, CHUNKS, JOINED_MESHES, MESH_SEEDS, PUBLIC_MESHES } from './collections.js';
const PUBLIC = b4a.from('public');
const WORKSPACE = b4a.from('workspace');
export function publicSeed(accountSeed, workspaceKey) {
    return crypto.hash([PUBLIC, accountSeed, workspaceKey]);
}
export function ownWorkspaceSeed(accountSeed) {
    return crypto.hash([WORKSPACE, accountSeed]);
}
export function isOwnWorkspace(account, workspace) {
    return (workspace.role === 'workspace' && b4a.equals(workspace.seed, ownWorkspaceSeed(account.seed)));
}
export async function onOwnSeed(account, meshKey) {
    const held = await account.view.get(MESH_SEEDS, { meshKey });
    return !!held && b4a.equals(held.seed, ownWorkspaceSeed(account.seed));
}
export async function ownWorkspaces(account) {
    const ours = account.ourMemberId;
    const mints = [];
    for await (const joined of account.view.find(JOINED_MESHES)) {
        const mine = !!ours && !!joined.workspace && b4a.equals(joined.memberId, ours);
        if (mine && (await onOwnSeed(account, joined.meshKey))) {
            mints.push(joined);
        }
    }
    const live = mints
        .filter((joined) => !joined.leftAt)
        .sort((a, b) => b4a.compare(a.meshKey, b.meshKey));
    return { own: live[0]?.meshKey ?? null, lost: mints.filter((joined) => joined !== live[0]) };
}
export async function lostMint(account, meshKey) {
    if (!(await onOwnSeed(account, meshKey))) {
        return false;
    }
    const { own } = await ownWorkspaces(account);
    return !own || !b4a.equals(own, meshKey);
}
export async function publicMeshKey(account, workspaceKey) {
    const id = b4a.toHex(workspaceKey);
    const row = await account.view.get(PUBLIC_MESHES, { id });
    return row?.meshKey ?? null;
}
function serving(agent, deviceId) {
    return !!agent && !agent.deletedAt && b4a.equals(agent.providerDeviceId, deviceId);
}
export async function servesAgents(mesh, deviceId) {
    for await (const agent of mesh.view.find(AGENTS)) {
        if (serving(agent, deviceId))
            return true;
    }
    return false;
}
export async function servesChat(mesh, deviceId, chatId) {
    const chat = await mesh.view.get(CHATS, { id: chatId });
    return !!chat && serving(await mesh.view.get(AGENTS, { id: chat.agentId }), deviceId);
}
export async function servesChunk(mesh, deviceId, chunkId) {
    const chunk = await mesh.view.get(CHUNKS, { id: chunkId });
    return !!chunk && servesChat(mesh, deviceId, chunk.chatId);
}
export async function servedChats(mesh, deviceId) {
    const chats = [];
    for await (const agent of mesh.view.find(AGENTS)) {
        if (!serving(agent, deviceId))
            continue;
        const range = { gte: { agentId: agent.id }, lte: { agentId: agent.id } };
        chats.push(...(await mesh.view.find(ACTIVE_CHATS_BY_AGENT, range).toArray()));
    }
    return chats;
}
export function publicRecordKey(accountKey, workspaceKey) {
    return `public-mesh/${b4a.toHex(accountKey)}/${b4a.toHex(workspaceKey)}`;
}
export function leftPublicRecordKey(accountKey, workspaceKey) {
    return `public-mesh-left/${b4a.toHex(accountKey)}/${b4a.toHex(workspaceKey)}`;
}
export function isPublicRecord(value) {
    return (isRecord(value) &&
        typeof value.writerSeed === 'string' &&
        typeof value.migrated === 'boolean' &&
        (value.key === null || typeof value.key === 'string'));
}
export function freshPublicRecord(migrated = false) {
    return { key: null, writerSeed: `public-${b4a.toHex(crypto.randomBytes(8))}`, migrated };
}
