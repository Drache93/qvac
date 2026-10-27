import { changed } from './changed.js';
import { FileChanges } from './files.js';
import { syncDeviceRevocation, syncOwnMember } from './devices.js';
import { syncChatTombstone } from './chats.js';
import { syncNotificationChunk } from './chunks.js';
import { AGENT_HOSTS, AGENT_USERS, AGENTS, CHATS, CHAT_GROUPS, CHUNKS, CHUNK_COUNTERS, DEVICES, KNOWLEDGE, KNOWLEDGE_ARTIFACTS, MEMBER_KEYS, MEMBERS, MESH_NAMES, MESH_SEEDS, PROJECT_DEVICE_KEYS, PROJECT_HOST_KEYS, PROJECT_KEYS, PROJECTS, PUBLIC_MESHES, PUBLIC_SEEDS, PURGED_CHATS, SKILL_SECRETS, WORKSPACE } from '../collections.js';
export async function syncChanges(mesh, view, from) {
    if (mesh.closing)
        return null;
    const pass = newPass();
    const reached = view.db.db.head();
    const snap = view.db.snapshot();
    const files = new FileChanges(snap, from);
    try {
        await walkChanges(mesh, { snap, from, files, pass });
    }
    catch (err) {
        mesh.log?.warn('sync', 'change sync cut short', err);
        pass.membershipMoved = pass.agentsDirty = pass.meshesChanged = pass.nameChanged = true;
        pass.groupsChanged = pass.secretsChanged = true;
    }
    try {
        await settle(mesh, pass);
    }
    finally {
        void offPath(mesh, files, pass)
            .catch((err) => {
            if (!mesh.closing) {
                mesh.log?.warn('sync', 'off-path sync failed', err);
            }
        })
            .finally(() => snap.close());
    }
    return reached && { key: reached.key, length: reached.length };
}
async function offPath(mesh, files, pass) {
    const indexingDirty = await files.ids();
    if (indexingDirty.size) {
        mesh.emit('indexing-dirty', indexingDirty);
    }
    await mesh.files.reclaimAttachments(pass.attachments);
    for (const row of pass.knowledge) {
        if (mesh.closing)
            return;
        await mesh.files.syncKnowledge(row);
    }
    for (const row of pass.artifacts) {
        if (mesh.closing)
            return;
        await mesh.files.syncArtifact(row);
    }
}
function newPass() {
    return {
        attachments: [],
        knowledge: [],
        artifacts: [],
        orderDirty: new Set(),
        purged: new Map(),
        unattestedDevice: false,
        membershipMoved: false,
        agentsDirty: false,
        meshesChanged: false,
        nameChanged: false,
        groupsChanged: false,
        secretsChanged: false
    };
}
function syncDevice(mesh, pass, device) {
    pass.membershipMoved = true;
    pass.unattestedDevice ||= !device.revoked && !device.memberId;
    syncOwnMember(mesh, device);
    syncDeviceRevocation(mesh, device);
}
async function settle(mesh, pass) {
    if (mesh.closing)
        return;
    if (pass.purged.size) {
        await mesh.fileIndex?.retireChats(pass.purged);
        for (const chatId of pass.purged.keys()) {
            mesh.emit('chat-purged', chatId);
        }
    }
    if (pass.attachments.length) {
        await mesh.fileIndex?.refresh(pass.attachments);
    }
    if (pass.unattestedDevice) {
        mesh.emit('unattested-device');
    }
    if (pass.membershipMoved) {
        mesh.emit('members-dirty');
        mesh.tallyMembership();
    }
    if (pass.agentsDirty) {
        mesh.emit('agents-dirty');
    }
    if (pass.secretsChanged) {
        mesh.emit('skill-secrets-dirty');
    }
    if (pass.orderDirty.size && mesh.syncChatOrder) {
        await mesh.syncChatOrder(pass.orderDirty);
    }
    mesh.emit('meshes-dirty', pass.meshesChanged, pass.groupsChanged);
    if (pass.nameChanged) {
        await mesh.refreshName();
        mesh.emit('mesh-named');
    }
}
async function walkChanges(mesh, { snap, from, files, pass }) {
    for await (const change of snap.changes({ from })) {
        if (mesh.closing)
            return;
        await files.add(change);
        if (HOSTING.has(change.collection)) {
            pass.agentsDirty = true;
            pass.meshesChanged ||= change.collection === PROJECT_HOST_KEYS;
            continue;
        }
        if (change.type === 'delete') {
            continue;
        }
        if (changed(change, DEVICES)) {
            syncDevice(mesh, pass, change.value);
        }
        else if (change.collection === MEMBERS) {
            pass.membershipMoved = true;
        }
        else if (change.collection === AGENTS) {
            pass.agentsDirty = true;
        }
        else if (changed(change, CHATS)) {
            pass.orderDirty.add(change.value.id);
            syncChatTombstone(mesh, change.value);
        }
        else if (changed(change, CHUNK_COUNTERS)) {
            pass.orderDirty.add(change.value.chatId);
        }
        else if (changed(change, CHUNKS)) {
            syncNotificationChunk(mesh, change.value);
            if (change.value.attachment) {
                pass.attachments.push(change.value);
            }
        }
        else if (changed(change, KNOWLEDGE)) {
            pass.knowledge.push(change.value);
        }
        else if (changed(change, KNOWLEDGE_ARTIFACTS)) {
            pass.artifacts.push(change.value);
        }
        else if (changed(change, PURGED_CHATS)) {
            pass.purged.set(change.value.chatId, change.value.at);
        }
        else if (FOLLOWED.has(change.collection)) {
            pass.meshesChanged = true;
        }
        else if (change.collection === MESH_NAMES) {
            pass.nameChanged = true;
        }
        else if (change.collection === CHAT_GROUPS || change.collection === WORKSPACE) {
            pass.groupsChanged = true;
        }
        else if (change.collection === SKILL_SECRETS) {
            pass.secretsChanged = true;
        }
    }
}
const HOSTING = new Set([
    AGENT_USERS,
    PUBLIC_SEEDS,
    PROJECT_HOST_KEYS,
    AGENT_HOSTS
]);
const FOLLOWED = new Set([
    '@qvac/joined-meshes',
    MESH_SEEDS,
    PUBLIC_MESHES,
    PROJECTS,
    PROJECT_KEYS,
    PROJECT_DEVICE_KEYS,
    MEMBER_KEYS
]);
