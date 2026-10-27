import { MAX_TOOL_CONFIGS_BYTES, toolConfigsWithinBounds } from '../../schema/qvac.js';
import { mustGetAgent } from './agent.js';
import { isRecord } from '../guards.js';
import { CoreError } from '../errors.js';
import { ACTIVE_TOOL_CONFIGS_BY_AGENT, TOOL_CONFIGS } from './collections.js';
function isPlainObject(value) {
    if (!isRecord(value)) {
        return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}
const SECRET_KEY_HINTS = [
    'authorization',
    'apikey',
    'password',
    'passwd',
    'passphrase',
    'secret',
    'privatekey',
    'accesskey',
    'accesstoken',
    'refreshtoken',
    'sessiontoken',
    'authtoken',
    'bearer',
    'credential'
];
const SECRET_KEY_PATTERNS = [/token$/];
const SECRET_REFERENCE_SUFFIXES = ['ref', 'refid', 'reference', 'id', 'name', 'handle', 'alias'];
function looksLikeSecretKey(key) {
    const normalized = key.toLowerCase().replace(/[-_\s]/g, '');
    const secretish = SECRET_KEY_HINTS.some((hint) => normalized.includes(hint)) ||
        SECRET_KEY_PATTERNS.some((pattern) => pattern.test(normalized));
    if (!secretish) {
        return false;
    }
    return !SECRET_REFERENCE_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}
function findReplicatedSecret(value, path) {
    if (Array.isArray(value)) {
        for (const item of value) {
            const hit = findReplicatedSecret(item, path);
            if (hit) {
                return hit;
            }
        }
        return null;
    }
    if (!isPlainObject(value)) {
        return null;
    }
    for (const key of Object.keys(value)) {
        if (looksLikeSecretKey(key))
            return `${path}.${key}`;
        const hit = findReplicatedSecret(value[key], `${path}.${key}`);
        if (hit) {
            return hit;
        }
    }
    return null;
}
function assertNoReplicatedSecrets(value, path) {
    const hit = findReplicatedSecret(value, path);
    if (hit) {
        throw new CoreError('TOOL_CONFIGS_SECRET', [hit]);
    }
}
export function toolConfigsCarrySecret(settings) {
    return findReplicatedSecret(settings, 'settings') !== null;
}
export async function getToolConfigs(store, agentId, toolName) {
    return store.view.get(TOOL_CONFIGS, { agentId, toolName });
}
export async function listToolConfigs(store, agentId) {
    const snap = store.view.snapshot();
    try {
        const rows = [];
        for await (const row of snap.find(ACTIVE_TOOL_CONFIGS_BY_AGENT, {
            gte: { agentId },
            lte: { agentId }
        })) {
            rows.push(row);
        }
        return rows;
    }
    finally {
        await snap.close();
    }
}
export async function setToolConfigs(store, input, agents = store) {
    const agent = await mustGetAgent(agents, input.agentId);
    if (agent.deletedAt) {
        throw new CoreError('AGENT_DELETED', [input.agentId]);
    }
    if (!isPlainObject(input.settings)) {
        throw new CoreError('TOOL_CONFIGS_INVALID');
    }
    assertNoReplicatedSecrets(input.settings, 'settings');
    const normalized = { ...input.settings };
    if (!toolConfigsWithinBounds(normalized)) {
        throw new CoreError('TOOL_CONFIGS_TOO_LARGE', [MAX_TOOL_CONFIGS_BYTES]);
    }
    const now = Date.now();
    const current = await getToolConfigs(store, input.agentId, input.toolName);
    const settings = {
        agentId: input.agentId,
        toolName: input.toolName,
        settings: normalized,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
        deletedAt: undefined
    };
    await store.dispatch('put-tool-configs', { settings });
    return settings;
}
export async function deleteToolConfigs(store, { agentId, toolName }, agents = store) {
    await mustGetAgent(agents, agentId);
    const current = await getToolConfigs(store, agentId, toolName);
    if (!current || current.deletedAt) {
        throw new CoreError('TOOL_CONFIGS_NOT_FOUND', [agentId, toolName]);
    }
    const now = Date.now();
    const settings = { ...current, deletedAt: now, updatedAt: now };
    await store.dispatch('put-tool-configs', { settings });
    return settings;
}
export async function softDeleteToolConfigsForAgent(store, agentId) {
    const snap = store.view.snapshot();
    try {
        for await (const row of snap.find(ACTIVE_TOOL_CONFIGS_BY_AGENT, {
            gte: { agentId },
            lte: { agentId }
        })) {
            if (store.closing)
                return;
            const now = Date.now();
            await store.dispatch('put-tool-configs', {
                settings: { ...row, deletedAt: now, updatedAt: Math.max(now, row.updatedAt + 1) }
            });
        }
    }
    finally {
        await snap.close();
    }
}
