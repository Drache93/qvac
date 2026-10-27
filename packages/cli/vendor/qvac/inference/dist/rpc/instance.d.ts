export declare const rpcServers: {
    start: (options: import("../index.js").StartRpcServerOptions, ctx: import("../runtime/index.js").RequestContext) => Promise<import("../index.js").RpcServerInfo>;
    stop: (serverId: string) => Promise<void>;
    close: () => Promise<void>;
    readonly size: number;
};
