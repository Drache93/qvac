import type { AddonLoaders, ToolDefinition, ToolExecuteContext, ToolFetch } from '../contract/index.ts';
import type { KnowledgeService } from '../contract/knowledge.ts';
import type { SandboxService } from '../contract/sandbox.ts';
import type { EgressProxyService } from '../contract/egress-proxy.ts';
import type { EmbedHost, ModelHost } from '../contract/models.ts';
import type { SpeechService } from '../contract/speech.ts';
import type { HarnessHook, SkillReadiness } from '../contract/index.ts';
import type { ExecLanguage, ExecRoute, ExecShell } from '../contract/exec.ts';
import { type PeerResolvers } from '../helpers/require-peers.ts';
import type { Context, Services } from './context.ts';
import type { Dispose } from './scope.ts';
declare module './context.ts' {
    interface Services {
        speech: SpeechService;
        models: ModelHost;
        embed: EmbedHost;
        knowledge: KnowledgeService;
        sandbox: SandboxService;
        'egress-proxy': EgressProxyService;
    }
}
export interface PluginContext {
    readonly services: Readonly<Services>;
    service<T = unknown>(name: string): T;
    onDispose(dispose: Dispose): void;
    readonly fetch: ToolFetch;
    readonly deniedRoots: readonly string[];
}
export interface PluginExec {
    languages?: readonly ExecLanguage[];
    routes?: readonly ExecRoute[];
    shell?: ExecShell;
}
export interface PluginSetup {
    tools?: ToolDefinition[];
    capabilities?: ToolDefinition[];
    hooks?: HarnessHook[];
    exec?: PluginExec;
    skills?: SkillReadiness[];
    services?: Record<string, unknown>;
    unload?(): Promise<void>;
    unloadIdle?(): Promise<void>;
    teardown?(): Promise<void> | void;
}
export interface HarnessPlugin {
    name: string;
    api: number;
    provides?: readonly string[];
    needs?: readonly string[];
    wants?: readonly string[];
    addons?: AddonLoaders;
    read?: readonly string[];
    validate?(): string | null;
    setup(ctx: PluginContext): Promise<PluginSetup> | PluginSetup;
}
export interface StartedExec {
    languages: ExecLanguage[];
    routes: ExecRoute[];
    shell?: ExecShell;
}
export interface StartedPlugins {
    tools: ToolDefinition[];
    capabilities: ToolDefinition[];
    hooks: HarnessHook[];
    skills: SkillReadiness[];
    exec: StartedExec;
    services: ReadonlyMap<string, unknown>;
}
export type FetchFor = (signal: ToolExecuteContext['signal'], mayConnect: (host: string) => Promise<boolean>) => ToolFetch;
export interface PluginStartOptions {
    fetch?: FetchFor;
    publish?(started: StartedPlugins): void;
}
export interface PluginRegistryOptions {
    services?: Record<string, unknown>;
    exec?: boolean;
    deniedRoots?: readonly string[];
}
export declare class PluginRegistry {
    static readonly API_VERSION = 1;
    static readonly EXEC_TOOL = "exec";
    readonly ctx: Context;
    private readonly _runtime;
    private readonly _core;
    private readonly _buildsExec;
    private readonly _deniedRoots;
    private readonly _loaded;
    private readonly _held;
    private readonly _services;
    private readonly _cleanupErrors;
    private _reserved;
    private _fetch;
    private _publish;
    private _revision;
    private _holds;
    private _drained;
    private _swapping;
    private _starting;
    private _teardown;
    private _closing;
    constructor(plugins: readonly HarnessPlugin[], options?: PluginRegistryOptions);
    static loadAddons(owner: string, addons?: AddonLoaders): Promise<void>;
    static requirePeers(plugin: string, peers: PeerResolvers): void;
    start(reserved: Iterable<string>, { fetch, publish }?: PluginStartOptions): Promise<StartedPlugins>;
    add(plugin: HarnessPlugin): Promise<void>;
    remove(name: string): Promise<void>;
    reload(name: string, plugin: HarnessPlugin): Promise<void>;
    hold(join?: boolean): Promise<() => void>;
    unload(): Promise<PromiseSettledResult<void>[]>;
    unloadIdle(): Promise<PromiseSettledResult<void>[]>;
    teardown(onError: (plugin: string, error: unknown) => void): Promise<void>;
    private _started;
    private _plugin;
    private _load;
    private _ownDispose;
    private _setUp;
    private _drop;
    private _check;
    private _removable;
    private _swap;
}
