import { type Context, type ServiceName } from './context.ts';
export interface Plugin {
    readonly name: string;
    readonly requires?: ReadonlyArray<ServiceName>;
    setup(ctx: Context): void | Promise<void>;
}
export declare class PluginRuntime {
    readonly ctx: Context;
    private readonly _plugins;
    private readonly _root;
    private readonly _scopes;
    private _opening;
    private _closing;
    private _disposing;
    constructor(plugins?: ReadonlyArray<Plugin>);
    ready(): Promise<void>;
    close(): Promise<void>;
    add(plugin: Plugin): Promise<void>;
    remove(name: string): Promise<void>;
    private _open;
    private _checkNames;
    private _assertStarting;
    private _setup;
    private _close;
    private _dispose;
    private _disposeScopes;
}
