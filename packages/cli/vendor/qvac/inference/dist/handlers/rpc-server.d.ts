import type { StartRpcServerRequest, StopRpcServerRequest, DiscoverRpcServersRequest } from '../schemas/rpc-server.js';
export declare function handleStartRpcServer(request: StartRpcServerRequest): Promise<{
    serverId: string;
    url: string;
    rdmaCapable: boolean;
    type: "startRpcServer";
}>;
export declare function handleStopRpcServer(request: StopRpcServerRequest): Promise<{
    type: "stopRpcServer";
}>;
export declare function handleDiscoverRpcServers(request: DiscoverRpcServersRequest): Promise<{
    type: "discoverRpcServers";
    servers: {
        url: string;
        rdmaAvailable: boolean;
        devices: {
            index: number;
            freeMemory: number;
            totalMemory: number;
        }[];
    }[];
}>;
export declare function closeRpcResources(): Promise<void>;
