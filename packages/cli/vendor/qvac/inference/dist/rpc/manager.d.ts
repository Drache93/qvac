import type { RequestContext } from '../runtime/request-context.js';
import type { StartRpcServerOptions, RpcServerInfo, RpcServerHandle } from '../schemas/rpc-server.js';
export type ManagedRpcServer = RpcServerHandle;
export interface RpcServerDependencies {
    start(options: StartRpcServerOptions): Promise<ManagedRpcServer>;
    ready(server: ManagedRpcServer, ctx: RequestContext): Promise<void>;
    advertise(topic: string, url: string): Promise<() => Promise<void>>;
}
export declare function createRpcServerManager(deps: RpcServerDependencies): {
    start: (options: StartRpcServerOptions, ctx: RequestContext) => Promise<RpcServerInfo>;
    stop: (serverId: string) => Promise<void>;
    close: () => Promise<void>;
    readonly size: number;
};
