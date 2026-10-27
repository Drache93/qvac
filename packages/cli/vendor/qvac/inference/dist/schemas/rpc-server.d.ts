import { z } from 'zod';
export declare const startRpcServerOptionsSchema: z.ZodObject<{
    host: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
    device: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    cache: z.ZodOptional<z.ZodBoolean>;
    threads: z.ZodOptional<z.ZodNumber>;
    expectRdma: z.ZodOptional<z.ZodBoolean>;
    allowNonLoopbackHost: z.ZodOptional<z.ZodBoolean>;
    discoveryTopic: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const rpcServerInfoSchema: z.ZodObject<{
    serverId: z.ZodString;
    url: z.ZodString;
    rdmaCapable: z.ZodBoolean;
}, z.core.$strip>;
export declare const startRpcServerRequestSchema: z.ZodObject<{
    host: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
    device: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    cache: z.ZodOptional<z.ZodBoolean>;
    threads: z.ZodOptional<z.ZodNumber>;
    expectRdma: z.ZodOptional<z.ZodBoolean>;
    allowNonLoopbackHost: z.ZodOptional<z.ZodBoolean>;
    discoveryTopic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"startRpcServer">;
    requestId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const startRpcServerResponseSchema: z.ZodObject<{
    serverId: z.ZodString;
    url: z.ZodString;
    rdmaCapable: z.ZodBoolean;
    type: z.ZodLiteral<"startRpcServer">;
}, z.core.$strip>;
export declare const stopRpcServerOptionsSchema: z.ZodObject<{
    serverId: z.ZodString;
}, z.core.$strip>;
export declare const stopRpcServerRequestSchema: z.ZodObject<{
    serverId: z.ZodString;
    type: z.ZodLiteral<"stopRpcServer">;
}, z.core.$strip>;
export declare const stopRpcServerResponseSchema: z.ZodObject<{
    type: z.ZodLiteral<"stopRpcServer">;
}, z.core.$strip>;
export declare const discoverRpcServersOptionsSchema: z.ZodObject<{
    topic: z.ZodString;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const rpcDeviceSchema: z.ZodObject<{
    index: z.ZodNumber;
    freeMemory: z.ZodNumber;
    totalMemory: z.ZodNumber;
}, z.core.$strip>;
export declare const rpcServerCandidateSchema: z.ZodObject<{
    url: z.ZodString;
    rdmaAvailable: z.ZodBoolean;
    devices: z.ZodArray<z.ZodObject<{
        index: z.ZodNumber;
        freeMemory: z.ZodNumber;
        totalMemory: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RpcDevice = z.infer<typeof rpcDeviceSchema>;
export declare const discoverRpcServersRequestSchema: z.ZodObject<{
    topic: z.ZodString;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"discoverRpcServers">;
    requestId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const discoverRpcServersResponseSchema: z.ZodObject<{
    type: z.ZodLiteral<"discoverRpcServers">;
    servers: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        rdmaAvailable: z.ZodBoolean;
        devices: z.ZodArray<z.ZodObject<{
            index: z.ZodNumber;
            freeMemory: z.ZodNumber;
            totalMemory: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type StartRpcServerOptions = z.infer<typeof startRpcServerOptionsSchema>;
export type RpcServerInfo = z.infer<typeof rpcServerInfoSchema>;
export type StopRpcServerOptions = z.infer<typeof stopRpcServerOptionsSchema>;
export type DiscoverRpcServersOptions = z.infer<typeof discoverRpcServersOptionsSchema>;
export type RpcServerCandidate = z.infer<typeof rpcServerCandidateSchema>;
export type StartRpcServerRequest = z.infer<typeof startRpcServerRequestSchema>;
export type StopRpcServerRequest = z.infer<typeof stopRpcServerRequestSchema>;
export type DiscoverRpcServersRequest = z.infer<typeof discoverRpcServersRequestSchema>;
/** Native handles remain private to the engine; callers receive an owned server ID. */
export interface RpcServerHandle {
    host: string;
    port: number;
    url: string;
    rdmaCapable: boolean;
    stop(): Promise<void>;
}
/** A model-independent serving capability registered in the Bare engine. */
export interface RpcServerProvider {
    start(options: Omit<StartRpcServerOptions, 'discoveryTopic'>): Promise<RpcServerHandle>;
}
