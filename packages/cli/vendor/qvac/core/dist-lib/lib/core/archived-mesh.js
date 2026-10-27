import b4a from 'b4a';
import crypto from 'hypercore-crypto';
import { copyBlob, copyChunks, stripped } from './chat-copy.js';
import { ownWorkspaceSeed, publicMeshKey, publicSeed } from './public-mesh.js';
import { Mesh } from './mesh.js';
import { recordedRole } from './local/index.js';
import { ACTIVE_AGENTS, ACTIVE_CHATS, ACTIVE_CHAT_GROUPS, ACTIVE_TOOL_CONFIGS_BY_AGENT, AGENTS, KNOWLEDGE, MESH_SEEDS } from './collections.js';
import { CoreError } from '../errors.js';
const MIGRATED_SUFFIX = ' (migrated)';
export async function withArchivedMesh(row, opts, fn) {
    if (!(await opts.storage.hasCore(crypto.discoveryKey(row.key)))) {
        throw new CoreError('ARCHIVE_NOT_FOUND');
    }
    const mesh = new Mesh(opts.store, {
        seed: row.seed,
        key: row.key,
        role: recordedRole(row),
        deviceId: opts.deviceId,
        writerSeed: row.writerSeed ?? undefined,
        logger: opts.logger
    });
    await mesh.ready();
    try {
        if (mesh.localLength === 0) {
            throw new CoreError('ARCHIVE_NOT_FOUND');
        }
        await mesh.autobee.update();
        const content = row.wasHome ? await openArchivedPublic(mesh, opts) : null;
        try {
            return await fn(content ?? mesh, mesh);
        }
        finally {
            await content?.close();
        }
    }
    finally {
        await mesh.close();
    }
}
async function ownWorkspaceKey(account) {
    const seed = ownWorkspaceSeed(account.seed);
    const keys = [];
    for await (const row of account.view.find(MESH_SEEDS)) {
        if (b4a.equals(row.seed, seed)) {
            keys.push(row.meshKey);
        }
    }
    return keys.sort(b4a.compare)[0] ?? null;
}
async function openArchivedPublic(account, opts) {
    const workspaceKey = await ownWorkspaceKey(account);
    const record = workspaceKey && (await opts.publicRecord?.(workspaceKey));
    const key = record?.key
        ? b4a.from(record.key, 'hex')
        : workspaceKey && (await publicMeshKey(account, workspaceKey));
    if (!workspaceKey ||
        !record?.migrated ||
        !key ||
        !(await opts.storage.hasCore(crypto.discoveryKey(key)))) {
        return null;
    }
    const mesh = new Mesh(opts.store, {
        seed: publicSeed(account.seed, workspaceKey),
        key,
        role: 'public',
        deviceId: opts.deviceId,
        writerSeed: record.writerSeed,
        logger: opts.logger
    });
    await mesh.ready();
    if (mesh.localLength === 0) {
        await mesh.close();
        return null;
    }
    await mesh.autobee.update();
    return mesh;
}
export async function countContents(mesh, into, agents = mesh) {
    const snap = mesh.view.snapshot();
    const defined = agents.view.snapshot();
    try {
        return {
            chats: await count(snap.find(ACTIVE_CHATS)),
            agents: await countAgents(defined, into),
            knowledge: (await liveKnowledge(snap)).length
        };
    }
    finally {
        await snap.close();
        await defined.close();
    }
}
async function countAgents(snap, into) {
    if (!into) {
        return count(snap.find(ACTIVE_AGENTS));
    }
    let appendable = 0;
    for (const row of await snap.find(ACTIVE_AGENTS).toArray()) {
        if (!(await alreadyHeld(into, row))) {
            appendable++;
        }
    }
    return appendable;
}
export async function migrateContents(from, into, configs = {}) {
    const snap = from.view.snapshot();
    try {
        const chats = await snap.find(ACTIVE_CHATS).toArray();
        const groups = await snap.find(ACTIVE_CHAT_GROUPS).toArray();
        const knowledge = await liveKnowledge(snap);
        const batch = into.batch();
        const targets = { into, configsFrom: configs.from ?? from, configsInto: configs.into ?? into };
        const agents = await migrateAgents(targets, new Set(chats.map((chat) => chat.agentId)));
        for (const group of groups) {
            batch.dispatch('put-chat-group', { group: stripped(group) });
        }
        for (const chat of chats) {
            batch.dispatch('put-chat', { chat: stripped(chat) });
        }
        await batch.flush();
        for (const chat of chats) {
            await copyChunks(snap, chat.id, { from, into });
        }
        let carried = 0;
        for (const row of knowledge) {
            if (await into.view.get(KNOWLEDGE, { id: row.id })) {
                carried++;
                continue;
            }
            const blobId = await copyBlob(from, into, row.blobId);
            if (!blobId) {
                continue;
            }
            batch.dispatch('add-knowledge', { knowledge: { ...stripped(row), blobId } });
            await batch.flush();
            carried++;
        }
        return { chats: chats.length, agents, knowledge: carried };
    }
    finally {
        await snap.close();
    }
}
async function migrateAgents({ into, configsFrom, configsInto }, used) {
    const settings = configsInto.batch();
    const copies = into === configsInto ? null : into.batch();
    const agents = await configsFrom.view.find(ACTIVE_AGENTS).toArray();
    const names = new Set((await configsInto.view.find(ACTIVE_AGENTS).toArray()).map((a) => a.name));
    let appended = 0;
    for (const row of agents) {
        if (await alreadyHeld(configsInto, row))
            continue;
        const { isDefault, ...agent } = stripped(row);
        const name = isDefault && names.has(agent.name) ? agent.name + MIGRATED_SUFFIX : agent.name;
        settings.dispatch('put-agent', { agent: { ...agent, name } });
        if (used.has(row.id)) {
            copies?.dispatch('put-agent', { agent: { ...agent, name } });
        }
        const rows = configsFrom.view.find(ACTIVE_TOOL_CONFIGS_BY_AGENT, {
            gte: { agentId: row.id },
            lte: { agentId: row.id }
        });
        for await (const config of rows) {
            settings.dispatch('put-tool-configs', { settings: stripped(config) });
        }
        appended++;
    }
    await settings.flush();
    await copies?.flush();
    return appended;
}
async function alreadyHeld(into, row) {
    return !!(await into.view.get(AGENTS, { id: row.id }));
}
async function liveKnowledge(snap) {
    const rows = await snap.find(KNOWLEDGE).toArray();
    return rows.filter((row) => !row.deletedAt);
}
async function count(stream) {
    let total = 0;
    for await (const _row of stream) {
        total++;
    }
    return total;
}
