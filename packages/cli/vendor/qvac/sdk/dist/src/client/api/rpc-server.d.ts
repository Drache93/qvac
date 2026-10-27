import { type StartRpcServerOptions, type StopRpcServerOptions, type DiscoverRpcServersOptions, type RpcServerInfo, type RpcServerCandidate } from '@qvac/inference/surface';
/**
 * Start a worker-owned native RPC server. Non-loopback binding and advertising require explicit opt-in.
 * Cancel a pending start with its promise.requestId.
 */
export declare function startRpcServer(options?: StartRpcServerOptions): Promise<RpcServerInfo> & {
    requestId: string;
};
/** Withdraw the announcement and await native stop. Bare stop has no deadline. */
export declare function stopRpcServer(options: StopRpcServerOptions): Promise<void>;
/**
 * Find private-network candidates with device inventories and server RDMA availability.
 * RDMA availability is a server-side offer, not a guarantee of the negotiated transport.
 * Use getRpcDeviceMap with the chosen endpoint registration order before loadModel.
 * Cancel a pending search with its promise.requestId.
 */
export declare function discoverRpcServers(options: DiscoverRpcServersOptions): Promise<RpcServerCandidate[]> & {
    requestId: string;
};
//# sourceMappingURL=rpc-server.d.ts.map