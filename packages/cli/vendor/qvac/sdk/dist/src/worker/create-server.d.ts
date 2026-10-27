import RPC from 'bare-rpc';
export declare function createBareKitRPCServer(): RPC;
export interface IPCClientOptions {
    onDisconnect?: () => void;
    authToken?: string | undefined;
}
export declare function createIPCClient(socketPath: string, options?: IPCClientOptions): RPC;
//# sourceMappingURL=create-server.d.ts.map