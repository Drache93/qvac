import b4a from 'b4a';
import crypto from 'hypercore-crypto';
import { settingConfigKey } from '../credential-pusher.js';
import { scopedKey } from '../oauth/keys.js';
import { CoreError } from '../errors.js';
import { isRecord } from '../guards.js';
import { SKILL_SECRETS } from './collections.js';
import { SKILL_SECRET_PREFIX } from './contract/skill-secrets.js';
import { memberBoxKeyPair, openSealedToMember, sealToMember } from './member-key.js';
const DEVICE_SHARED_CREDENTIAL_KEYS = new Set(['obsidian_vault_path']);
export async function storeSkillSecret(opts, request) {
    const fields = await opts.setupFields(request.skillName);
    if (fields && request.values.some(({ key }) => !fields.has(key))) {
        throw new CoreError('SKILL_SETUP_FIELD_UNKNOWN');
    }
    const entries = request.values.map(({ key, value }) => ({
        key: fields?.get(key) === false
            ? settingConfigKey(undefined, request.skillName, key)
            : scopedKey(DEVICE_SHARED_CREDENTIAL_KEYS.has(key) ? undefined : request.agentId, key),
        value
    }));
    if (entries.length === 0) {
        return;
    }
    await opts.local.setAll(entries);
    await opts.onstored();
}
export function isDeviceKey(key) {
    return DEVICE_SHARED_CREDENTIAL_KEYS.has(key.slice(key.lastIndexOf('.') + 1));
}
function syncedKey(account, key) {
    return `skill-secrets/${b4a.toHex(account.key)}/${key}`;
}
async function readSynced({ account, local }, key) {
    const row = await local.get(syncedKey(account, key));
    const at = isRecord(row) ? row.at : null;
    const digest = isRecord(row) ? row.digest : null;
    return typeof at === 'number' && typeof digest === 'string' ? { at, digest } : null;
}
function encoded(value) {
    return b4a.from(JSON.stringify(value) ?? 'null');
}
function digestOf(value) {
    return b4a.toHex(crypto.hash(encoded(value)));
}
function opened(row, pair) {
    const message = openSealedToMember(row.sealed, pair);
    try {
        return message ? { value: JSON.parse(b4a.toString(message)) } : null;
    }
    catch {
        return null;
    }
}
async function sendEdits(sync, held) {
    const { account, local } = sync;
    const boxKey = memberBoxKeyPair(account.seed).publicKey;
    const batch = account.writable ? account.batch() : null;
    const marks = [];
    for (const { key, value } of await local.listPrefix(SKILL_SECRET_PREFIX)) {
        const synced = await readSynced(sync, key);
        const digest = digestOf(value);
        const row = held.get(key);
        if (isDeviceKey(key) || (synced ? synced.digest === digest : !!row)) {
            continue;
        }
        held.delete(key);
        const at = Math.max(Date.now(), (row?.updatedAt ?? 0) + 1);
        batch?.dispatch('put-skill-secret', {
            key,
            sealed: sealToMember(encoded(value), boxKey),
            updatedAt: at
        });
        marks.push({ key: syncedKey(account, key), value: { at, digest } });
    }
    await batch?.flush();
    return batch ? marks : [];
}
async function takeRows(sync, rows) {
    const pair = memberBoxKeyPair(sync.account.seed);
    const writes = [];
    for (const row of rows) {
        const synced = await readSynced(sync, row.key);
        const fresh = !isDeviceKey(row.key) && (!synced || synced.at < row.updatedAt);
        const open = fresh ? opened(row, pair) : null;
        if (open) {
            const mark = { at: row.updatedAt, digest: digestOf(open.value) };
            writes.push({ key: row.key, value: open.value });
            writes.push({ key: syncedKey(sync.account, row.key), value: mark });
        }
    }
    return writes;
}
export async function syncSkillSecrets(sync) {
    const rows = await sync.account.view.find(SKILL_SECRETS).toArray();
    const held = new Map(rows.map((row) => [row.key, row]));
    const marks = await sendEdits(sync, held);
    const taken = await takeRows(sync, held.values());
    await sync.local.setAll([...marks, ...taken]);
    return taken.length > 0;
}
