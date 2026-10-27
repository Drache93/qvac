import { HarnessError } from '../errors.js';
import { Policy } from '../policy/index.js';
import { canonicalDenyRoots, defaultRealpath } from '../tools/fs/scope.js';
import { TOOLSETS } from '../tools/toolsets.js';
import { loadAddons } from './addons.js';
import { requirePeers } from '../helpers/require-peers.js';
import { PluginRuntime } from './runtime.js';
const API_VERSION = 1;
const EXEC_TOOL = 'exec';
const BOOT = Math.random().toString(36).slice(2, 10);
function fail(name, reason) {
    throw new Error(`plugin '${name}' ${reason}`);
}
function validated(plugin) {
    const message = plugin.validate?.();
    if (message) {
        fail(plugin.name, `config is invalid: ${message}`);
    }
}
function providersOf(plugins, core) {
    const providers = new Map();
    for (const plugin of plugins) {
        for (const service of plugin.provides ?? []) {
            if (core.has(service)) {
                fail(plugin.name, `provides '${service}', which the core provides`);
            }
            const other = providers.get(service);
            if (other) {
                fail(plugin.name, `provides '${service}', which '${other}' already provides`);
            }
            providers.set(service, plugin.name);
        }
    }
    return providers;
}
function checkPlugins(plugins, core) {
    const names = new Set();
    for (const plugin of plugins) {
        if (plugin.api !== API_VERSION) {
            fail(plugin.name, `targets plugin api ${plugin.api}, not ${API_VERSION}`);
        }
        if (names.has(plugin.name)) {
            fail(plugin.name, 'is listed twice');
        }
        names.add(plugin.name);
    }
    const providers = providersOf(plugins, core);
    for (const plugin of plugins) {
        const missing = (plugin.needs ?? []).find((service) => !providers.has(service) && !core.has(service));
        if (missing) {
            fail(plugin.name, `needs '${missing}', which no plugin provides`);
        }
    }
    return providers;
}
function startOrder(plugins, providers, core) {
    const ordered = [];
    const placed = new Set();
    const pending = [...plugins];
    while (pending.length > 0) {
        const index = pending.findIndex((plugin) => (plugin.needs ?? []).every((service) => core.has(service) || placed.has(providers.get(service) ?? '')) &&
            (plugin.wants ?? []).every((service) => !providers.has(service) || placed.has(providers.get(service) ?? '')));
        if (index === -1) {
            fail(pending[0].name, 'is part of a dependency cycle');
        }
        const [next] = pending.splice(index, 1);
        ordered.push(next);
        placed.add(next.name);
    }
    return ordered;
}
function contextFor(plugin, ctx, { onDispose, fetch, deniedRoots }) {
    function service(name) {
        if (!(plugin.needs ?? []).includes(name)) {
            fail(plugin.name, `asked for '${name}', which it does not name in needs`);
        }
        return readService(ctx, name);
    }
    return { services: servicesFor(plugin, ctx), service, onDispose, fetch, deniedRoots };
}
function servicesFor(plugin, ctx) {
    const view = {};
    for (const name of [
        ...(plugin.needs ?? []),
        ...(plugin.wants ?? []),
        ...(plugin.provides ?? [])
    ]) {
        view[name] = { enumerable: true, get: () => Reflect.get(ctx, name) };
    }
    return Object.create(null, view);
}
function readService(ctx, name) {
    return ctx.get(name);
}
function provideService(ctx, name, value) {
    ctx.provide(name, value);
}
function ruledTool(tool, plugin, policy) {
    const { read = [] } = plugin;
    if (!TOOLSETS.some((toolset) => toolset === tool.toolset)) {
        fail(plugin.name, `gives tool '${tool.name}' toolset ${tool.toolset}, not one of TOOLSETS`);
    }
    const granted = read.includes(tool.name);
    return {
        ...tool,
        autoApprove: granted ? tool.autoApprove : undefined,
        policyVersion: `${policy}${tool.policyVersion ?? ''}`,
        effect: granted ? tool.effect : () => 'write'
    };
}
const offline = () => Promise.reject(new HarnessError('FETCH_REFUSED', ['the run has the network off']));
const unfetched = () => Promise.reject(new HarnessError('FETCH_REFUSED', ['the host gave the plugins no fetch']));
const anywhere = () => Promise.resolve(true);
function declaredHosts(targets, allowed) {
    const hostnames = new Set();
    for (const target of typeof targets === 'string' ? [targets] : (targets ?? [])) {
        try {
            hostnames.add(new URL(target).hostname);
        }
        catch {
        }
    }
    return (host) => Promise.resolve(hostnames.has(host) && (!allowed || Policy.allowsHost(allowed, host)));
}
function withFetch(tool, fetchFor) {
    const { egress, execute } = tool;
    if (!egress || !fetchFor) {
        return tool;
    }
    return {
        ...tool,
        execute: (args, ctx = {}) => execute(args, {
            ...ctx,
            fetch: ctx.policy?.network.mode === 'off'
                ? offline
                : fetchFor(ctx.signal, declaredHosts(egress(args), Policy.hostsOf(ctx.policy)))
        })
    };
}
function ruledTools(plugin, tools, { taken, fetch, revision }) {
    const { read = [] } = plugin;
    const unknown = read.find((name) => !tools.some((tool) => tool.name === name));
    if (unknown) {
        fail(plugin.name, `has no tool '${unknown}' to read`);
    }
    const policy = JSON.stringify({
        plugin: plugin.name,
        api: plugin.api,
        read: [...read].sort(),
        revision: revision > 0 ? `${BOOT}.${revision}` : undefined
    });
    const own = new Set();
    return tools.map((tool) => {
        if (taken.has(tool.name) || own.has(tool.name)) {
            fail(plugin.name, `adds tool '${tool.name}', which the harness already has`);
        }
        own.add(tool.name);
        return withFetch(ruledTool(tool, plugin, policy), fetch);
    });
}
function claimCapabilities(name, capabilities, taken) {
    const claimed = new Set(taken);
    for (const { name: tool } of capabilities) {
        if (claimed.has(tool)) {
            fail(name, `adds capability '${tool}', which the harness already has`);
        }
        claimed.add(tool);
    }
    return [...capabilities];
}
function ruledHooks(name, hooks, revision) {
    const prefix = revision > 0 ? `${name}@${BOOT}.${revision}` : name;
    const counts = new Map();
    return hooks.map((hook) => {
        const count = (counts.get(hook.phase) ?? 0) + 1;
        counts.set(hook.phase, count);
        const { matcher, timeoutMs } = hook;
        return {
            name: `${prefix}:${hook.name?.trim() || `${hook.phase}:${count}`}`,
            phase: hook.phase,
            matcher,
            timeoutMs,
            run: async (ctx, options) => withoutAllow(await hook.run(ctx, options))
        };
    });
}
function withoutAllow(result) {
    if (!result || !('permission' in result) || result.permission !== 'allow') {
        return result;
    }
    const { permission: _permission, ...rest } = result;
    return rest;
}
function claimSkills(name, skills, others) {
    const claimed = new Map(others);
    for (const { skill } of skills) {
        const other = claimed.get(skill);
        if (other) {
            fail(name, `claims skill '${skill}', which '${other}' already claims`);
        }
        claimed.set(skill, name);
    }
    return [...skills];
}
function exposeServices(plugin, setup, ctx) {
    const { name, provides = [] } = plugin;
    const given = Object.keys(setup.services ?? {}).sort();
    if (given.join('\0') !== [...provides].sort().join('\0')) {
        fail(name, `must set up exactly the services it provides: ${provides.join(', ') || 'none'}`);
    }
    for (const service of provides) {
        provideService(ctx, service, setup.services?.[service]);
    }
}
function contributes(exec) {
    return Boolean(exec && (exec.languages?.length || exec.routes?.length || exec.shell));
}
function claimExec(plugin, exec, { builds, hostExec, others }) {
    if (!contributes(exec)) {
        return {};
    }
    if (!builds) {
        if (hostExec) {
            fail(plugin.name, 'adds to exec, which the host composed itself: set HarnessOptions.exec');
        }
        return {};
    }
    if (exec.shell) {
        const other = others.find((loaded) => loaded.exec.shell);
        if (other) {
            fail(plugin.name, `adds an exec shell, which '${other.plugin.name}' already adds`);
        }
    }
    return exec;
}
function execOf(loaded) {
    return {
        languages: loaded.flatMap((each) => [...(each.exec.languages ?? [])]),
        routes: loaded.flatMap((each) => [...(each.exec.routes ?? [])]),
        shell: loaded.find((each) => each.exec.shell)?.exec.shell
    };
}
export class PluginRegistry {
    static API_VERSION = API_VERSION;
    static EXEC_TOOL = EXEC_TOOL;
    ctx;
    _runtime;
    _core;
    _buildsExec;
    _deniedRoots;
    _loaded = [];
    _held = [];
    _services = new Map();
    _cleanupErrors = [];
    _reserved = new Set();
    _fetch = undefined;
    _publish = undefined;
    _revision = 0;
    _holds = 0;
    _drained = null;
    _swapping = null;
    _starting = null;
    _teardown = null;
    _closing = false;
    constructor(plugins, options = {}) {
        const core = new Map(Object.entries(options.services ?? {}));
        this._core = new Set(core.keys());
        this._buildsExec = options.exec ?? false;
        this._deniedRoots = [...(options.deniedRoots ?? [])];
        const order = startOrder(plugins, checkPlugins(plugins, this._core), this._core);
        for (const plugin of order) {
            validated(plugin);
        }
        const runtime = new PluginRuntime(order.map((plugin) => this._plugin(plugin, 0, (loaded) => this._loaded.push(loaded))));
        for (const [name, value] of core) {
            provideService(runtime.ctx, name, value);
        }
        runtime.ctx.onDispose(() => {
            this._services.clear();
        });
        this.ctx = runtime.ctx;
        this._runtime = runtime;
    }
    static loadAddons(owner, addons) {
        return loadAddons(owner, addons);
    }
    static requirePeers(plugin, peers) {
        requirePeers(`@qvac/harness/plugins/${plugin}`, peers);
    }
    start(reserved, { fetch, publish } = {}) {
        if (this._closing) {
            return Promise.reject(new Error('Plugin registry is closing or closed'));
        }
        if (this._starting)
            return this._starting;
        this._reserved = new Set(reserved);
        this._fetch = fetch;
        this._publish = publish;
        this._starting = this._runtime.ready().then(() => this._started());
        return this._starting;
    }
    add(plugin) {
        return this._swap(() => {
            this._check(plugin);
            return async () => {
                await this._setUp(plugin, (loaded) => this._loaded.push(loaded));
            };
        });
    }
    remove(name) {
        return this._swap(() => {
            this._removable(name);
            return async () => {
                await this._drop(name);
            };
        });
    }
    reload(name, plugin) {
        return this._swap(() => {
            if (plugin.name !== name) {
                fail(plugin.name, `cannot reload plugin '${name}'`);
            }
            this._removable(name);
            this._check(plugin, name);
            return async () => {
                const index = await this._drop(name);
                await this._setUp(plugin, (loaded) => this._loaded.splice(index, 0, loaded));
            };
        });
    }
    async hold(join = false) {
        while (this._swapping && !(join && this._holds > 0)) {
            await this._swapping;
        }
        this._holds++;
        let held = true;
        return () => {
            if (!held)
                return;
            held = false;
            if (--this._holds === 0) {
                this._drained?.();
                this._drained = null;
            }
        };
    }
    unload() {
        return Promise.allSettled(this._held.map(async (setup) => setup.unload?.()));
    }
    unloadIdle() {
        return Promise.allSettled(this._held.map(async (setup) => setup.unloadIdle?.()));
    }
    teardown(onError) {
        this._closing = true;
        this._teardown ??= Promise.resolve(this._swapping)
            .then(() => this._runtime.close())
            .catch((error) => {
            if (!this._cleanupErrors.length) {
                onError('runtime', error);
            }
            for (const failure of this._cleanupErrors) {
                onError(failure.plugin, failure.error);
            }
        });
        return this._teardown;
    }
    _started() {
        return {
            tools: this._loaded.flatMap((loaded) => loaded.tools),
            capabilities: this._loaded.flatMap((loaded) => loaded.capabilities),
            hooks: this._loaded.flatMap((loaded) => loaded.hooks),
            skills: this._loaded.flatMap((loaded) => loaded.skills),
            exec: execOf(this._loaded),
            services: this._services
        };
    }
    _plugin(plugin, revision, place) {
        return {
            name: plugin.name,
            setup: async (ctx) => place(await this._load(plugin, revision, ctx))
        };
    }
    async _load(plugin, revision, ctx) {
        for (const name of plugin.needs ?? []) {
            readService(ctx, name);
        }
        await loadAddons(`plugin '${plugin.name}'`, plugin.addons);
        const onDispose = (dispose) => this._ownDispose(ctx, plugin.name, dispose);
        const fetch = this._fetch ? this._fetch(undefined, anywhere) : unfetched;
        const deniedRoots = Object.freeze(await canonicalDenyRoots(this._deniedRoots, defaultRealpath));
        const setup = await plugin.setup(contextFor(plugin, ctx, { onDispose, fetch, deniedRoots }));
        this._held.push(setup);
        if (setup.teardown) {
            onDispose(setup.teardown.bind(setup));
        }
        const taken = new Set(this._reserved);
        const claimed = new Map();
        for (const other of this._loaded) {
            for (const tool of [...other.tools, ...other.capabilities]) {
                taken.add(tool.name);
            }
            for (const { skill } of other.skills) {
                claimed.set(skill, other.plugin.name);
            }
        }
        const tools = ruledTools(plugin, setup.tools ?? [], { taken, fetch: this._fetch, revision });
        const capabilities = claimCapabilities(plugin.name, setup.capabilities ?? [], [
            ...taken,
            ...tools.map((tool) => tool.name)
        ]);
        await Promise.all([...tools, ...capabilities].map((tool) => loadAddons(`tool '${tool.name}'`, tool.addons)));
        const loaded = {
            plugin,
            setup,
            tools,
            capabilities,
            hooks: ruledHooks(plugin.name, setup.hooks ?? [], revision),
            skills: claimSkills(plugin.name, setup.skills ?? [], claimed),
            exec: claimExec(plugin, setup.exec, {
                builds: this._buildsExec,
                hostExec: this._reserved.has(EXEC_TOOL),
                others: this._loaded
            })
        };
        exposeServices(plugin, setup, ctx);
        for (const service of plugin.provides ?? []) {
            this._services.set(service, setup.services?.[service]);
        }
        return loaded;
    }
    _ownDispose(ctx, plugin, dispose) {
        ctx.onDispose(async () => {
            try {
                await dispose();
            }
            catch (error) {
                this._cleanupErrors.push({ plugin, error });
                throw error;
            }
        });
    }
    async _setUp(plugin, place) {
        const setups = this._held.length;
        try {
            await this._runtime.add(this._plugin(plugin, ++this._revision, place));
        }
        catch (error) {
            await Promise.allSettled(this._held.splice(setups).map(async (setup) => setup.unload?.()));
            throw error;
        }
    }
    async _drop(name) {
        const index = this._loaded.findIndex((loaded) => loaded.plugin.name === name);
        const [{ plugin, setup }] = this._loaded.splice(index, 1);
        this._held.splice(this._held.indexOf(setup), 1);
        const errors = this._cleanupErrors.length;
        try {
            await this._runtime.remove(name);
        }
        finally {
            this._cleanupErrors.length = errors;
            for (const service of plugin.provides ?? []) {
                this._services.delete(service);
            }
            await setup.unload?.();
        }
        return index;
    }
    _check(plugin, replacing) {
        const others = this._loaded
            .map((loaded) => loaded.plugin)
            .filter((other) => other.name !== replacing);
        checkPlugins([...others, plugin], this._core);
        validated(plugin);
    }
    _removable(name) {
        const target = this._loaded.find((loaded) => loaded.plugin.name === name);
        if (!target) {
            fail(name, 'is not loaded');
        }
        const provides = target.plugin.provides ?? [];
        const dependents = this._loaded
            .filter(({ plugin }) => (plugin.needs ?? []).some((need) => provides.includes(need)))
            .map(({ plugin }) => `'${plugin.name}'`);
        if (dependents.length > 0) {
            fail(name, `is needed by ${dependents.join(', ')}`);
        }
    }
    _swap(prepare) {
        const swap = Promise.resolve(this._swapping).then(async () => {
            if (this._closing || !this._starting) {
                throw new Error('Plugin registry is not running');
            }
            await this._starting;
            const apply = prepare();
            if (this._holds > 0) {
                await new Promise((resolve) => {
                    this._drained = resolve;
                });
            }
            try {
                await apply();
            }
            finally {
                this._publish?.(this._started());
            }
        });
        const settled = swap.catch(noop);
        this._swapping = settled;
        void settled.then(() => {
            if (this._swapping === settled) {
                this._swapping = null;
            }
        });
        return swap;
    }
}
function noop() { }
