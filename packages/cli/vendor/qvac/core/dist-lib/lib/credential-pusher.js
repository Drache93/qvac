import { OBSIDIAN_VAULT_PATH_CREDENTIAL_KEY } from './obsidian-key.js';
import { scopedKey } from './oauth.js';
import { oauthSpecs } from './oauth/registry.js';
import { REFRESH_SKEW_MS, resolveOAuthCredential } from './oauth/resolve.js';
import { buildProviderConfig } from './oauth/providers.js';
import { refreshOAuthTokens } from './oauth/token-exchange.js';
import ScopeLock from 'scope-lock';
import { credentialSlots } from '@qvac/harness/skill-manifest';
import { errorMessage } from './guards.js';
const PLAIN_KEYS = ['github_access_token', OBSIDIAN_VAULT_PATH_CREDENTIAL_KEY];
const REFRESH_INTERVAL = 10 * 60 * 1000;
const MIN_REFRESH_DELAY = 30_000;
function storeKey(key, agentId) {
    return agentId ? `${agentId}\0${key}` : key;
}
export function nextRefreshDelay(entries, now = Date.now()) {
    let nearest = null;
    for (const entry of entries) {
        if (typeof entry.expiresAt === 'number' && entry.expiresAt > 0) {
            if (nearest === null || entry.expiresAt < nearest) {
                nearest = entry.expiresAt;
            }
        }
    }
    if (nearest === null) {
        return REFRESH_INTERVAL;
    }
    return Math.min(REFRESH_INTERVAL, Math.max(MIN_REFRESH_DELAY, nearest - now - REFRESH_SKEW_MS));
}
async function oauthEntry(engine, spec, agentId) {
    const { credentialKey, stateKey } = spec;
    const token = await resolveOAuthCredential({
        engine,
        agentId,
        credentialKey,
        stateKey,
        requireClientSecret: spec.tokenAuth !== 'pkce-only',
        refresh: (args) => refreshOAuthTokens(buildProviderConfig(spec, { clientId: args.clientId, clientSecret: args.clientSecret }), args.refreshToken)
    });
    if (!token) {
        return null;
    }
    const { value } = await engine.configGet({
        key: scopedKey(agentId, stateKey)
    });
    let expiresAt;
    try {
        const state = typeof value === 'string' ? JSON.parse(value) : null;
        expiresAt = typeof state?.expiresAt === 'number' ? state.expiresAt : undefined;
    }
    catch { }
    return {
        key: credentialKey,
        token,
        expiresAt,
        agentId
    };
}
async function plainEntry(engine, key, agentId) {
    const { value } = await engine.configGet({ key: scopedKey(agentId, key) });
    if (typeof value !== 'string' || value === '') {
        return null;
    }
    return {
        key,
        token: value,
        agentId
    };
}
export function credentialOwners(catalog) {
    const owners = new Map();
    for (const skill of catalog) {
        for (const key of credentialSlots(skill).flat()) {
            const list = owners.get(key) ?? [];
            if (!list.includes(skill.name)) {
                list.push(skill.name);
            }
            owners.set(key, list);
        }
    }
    return owners;
}
export function settingFields(catalog) {
    const fields = [];
    for (const skill of catalog) {
        for (const field of (skill.setup?.routes ?? []).flatMap((route) => route.fields ?? [])) {
            if (field.secret === true)
                continue;
            if (fields.some((f) => f.skill === skill.name && f.key === field.key)) {
                continue;
            }
            fields.push({ skill: skill.name, key: field.key });
        }
    }
    return fields;
}
export function settingConfigKey(agentId, skill, key) {
    return scopedKey(agentId, `settings.${skill}.${key}`);
}
function fanOut(entry, owners) {
    const skills = owners.get(entry.key) ?? [];
    return skills.length > 0 ? skills.map((skill) => ({ ...entry, skill })) : [entry];
}
async function resolveEntry({ mk, failure, read }, { last, owners, logger }) {
    try {
        const entry = await read();
        if (!entry) {
            last.delete(mk);
            return [];
        }
        last.set(mk, entry);
        return fanOut(entry, owners);
    }
    catch (err) {
        logger?.warn('credential-pusher', failure, errorMessage(err));
        const kept = last.get(mk);
        return kept ? fanOut(kept, owners) : [];
    }
}
async function resolveScope(agentId, resolution) {
    const { engine, specs } = resolution;
    const specKeys = new Set(specs.map((spec) => spec.credentialKey));
    const pending = [
        ...specs.map((spec) => ({
            mk: storeKey(spec.credentialKey, agentId),
            failure: `credential resolve failed for ${spec.credentialKey}`,
            read: () => oauthEntry(engine, spec, agentId)
        })),
        ...PLAIN_KEYS.filter((key) => !specKeys.has(key)).map((key) => ({
            mk: storeKey(key, agentId),
            failure: `credential read failed for ${key}`,
            read: () => plainEntry(engine, key, agentId)
        }))
    ];
    const resolved = await Promise.all(pending.map((entry) => resolveEntry(entry, resolution)));
    return resolved.flat();
}
async function resolveSettings(engine, scopes, { catalog, logger }) {
    const fields = settingFields(catalog);
    if (fields.length === 0) {
        return [];
    }
    const resolved = await Promise.all(scopes.flatMap((agentId) => fields.map(async ({ skill, key }) => {
        try {
            const { value } = await engine.configGet({ key: settingConfigKey(agentId, skill, key) });
            if (typeof value !== 'string' || value === '') {
                return null;
            }
            return { skill, key, value, agentId };
        }
        catch (err) {
            logger?.warn('credential-pusher', `setting read failed for ${skill}.${key}`, errorMessage(err));
            return null;
        }
    })));
    const entries = [];
    for (const entry of resolved) {
        if (entry) {
            entries.push(entry);
        }
    }
    return entries;
}
async function accountScopes(engine) {
    const { meshId } = await engine.account({});
    const ids = meshId
        ? ((await engine.listAgents({ meshId })).agents ?? []).map((agent) => agent.id)
        : [];
    return { meshId, scopes: [undefined, ...ids] };
}
export function startCredentialPusher(harness, engine, logger) {
    const last = new Map();
    const watches = new Map();
    const agentLists = new Map();
    let disposed = false;
    let timer = null;
    const pushLock = new ScopeLock({ debounce: true });
    const watch = (key) => {
        const stream = engine.configWatch({ key });
        watches.set(key, stream);
        (async () => {
            for await (const _ of stream) {
                schedule();
            }
            if (disposed || watches.get(key) !== stream) {
                return;
            }
            logger?.warn('credential-pusher', `credential watch ended for ${key}, change propagation degrades to the interval until restart`);
        })().catch((err) => {
            if (disposed || watches.get(key) !== stream)
                return;
            logger?.warn('credential-pusher', `credential watch ended for ${key}`, errorMessage(err));
        });
    };
    const syncWatches = (oauthKeys, scopes) => {
        if (disposed)
            return;
        const keys = new Set([...oauthKeys, ...PLAIN_KEYS]);
        const wanted = new Set(scopes.flatMap((agentId) => [...keys].map((key) => scopedKey(agentId, key))));
        for (const [key, stream] of watches) {
            if (wanted.has(key))
                continue;
            try {
                stream.destroy();
            }
            catch { }
            watches.delete(key);
        }
        for (const key of wanted) {
            if (!watches.has(key)) {
                watch(key);
            }
        }
        for (const mk of last.keys()) {
            const key = mk.includes('\0') ? mk.slice(mk.indexOf('\0') + 1) : mk;
            if (!keys.has(key)) {
                last.delete(mk);
            }
        }
    };
    const syncAgentsWatch = (meshId) => {
        if (disposed)
            return;
        for (const [id, stream] of agentLists) {
            if (id === meshId)
                continue;
            try {
                stream.destroy();
            }
            catch { }
            agentLists.delete(id);
        }
        if (!meshId || agentLists.has(meshId)) {
            return;
        }
        const stream = engine.agentsWatch({ meshId });
        agentLists.set(meshId, stream);
        (async () => {
            for await (const _ of stream) {
                schedule();
            }
        })().catch(noop);
    };
    const armTimer = (delay) => {
        if (disposed)
            return;
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            timer = null;
            schedule();
        }, delay);
    };
    const catalog = async () => {
        if (!harness.skills)
            return [];
        try {
            return await harness.skills(null, null, { skipCredentialProbe: true });
        }
        catch (err) {
            logger?.warn('credential-pusher', 'skill catalog read failed', errorMessage(err));
            return null;
        }
    };
    const pushAll = async () => {
        const entries = [];
        try {
            const skills = await catalog();
            if (skills === null) {
                return;
            }
            const owners = credentialOwners(skills);
            const specs = oauthSpecs(skills);
            const { meshId, scopes } = await accountScopes(engine);
            syncWatches(specs.map((spec) => spec.credentialKey), scopes);
            syncAgentsWatch(meshId);
            const resolution = { engine, last, owners, specs, logger };
            const resolved = await Promise.all(scopes.map((agentId) => resolveScope(agentId, resolution)));
            entries.push(...resolved.flat());
            if (disposed) {
                return;
            }
            await harness.setCredentials(entries);
            if (harness.setSkillSettings) {
                await harness.setSkillSettings(await resolveSettings(engine, scopes, { catalog: skills, logger }));
            }
        }
        finally {
            if (!disposed) {
                armTimer(nextRefreshDelay(entries));
            }
        }
    };
    const schedule = async () => {
        if (disposed)
            return;
        if (!(await pushLock.lock()))
            return;
        try {
            if (!disposed) {
                await pushAll();
            }
        }
        catch (err) {
            logger?.warn('credential-pusher', 'credential push failed', errorMessage(err));
        }
        finally {
            pushLock.unlock();
        }
    };
    const sync = async () => {
        if (disposed)
            return;
        await pushLock.flush();
        if (disposed) {
            return;
        }
        if (!(await pushLock.lock())) {
            await pushLock.flush();
            return;
        }
        try {
            if (!disposed) {
                await pushAll();
            }
        }
        catch (err) {
            logger?.warn('credential-pusher', 'credential sync failed', errorMessage(err));
        }
        finally {
            pushLock.unlock();
        }
    };
    const first = schedule();
    const stop = async () => {
        if (disposed)
            return;
        disposed = true;
        if (timer) {
            clearTimeout(timer);
        }
        timer = null;
        for (const stream of [...watches.values(), ...agentLists.values()]) {
            try {
                stream.destroy();
            }
            catch { }
        }
        watches.clear();
        agentLists.clear();
        pushLock.destroy();
        await pushLock.flush();
    };
    return Object.assign(stop, { sync, ready: () => first });
}
function noop() { }
