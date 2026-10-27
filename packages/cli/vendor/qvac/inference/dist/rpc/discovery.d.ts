import Hyperswarm from 'hyperswarm';
import type { RequestContext } from '../runtime/request-context.js';
import { queryRpcInventory } from './inventory.js';
import type { RpcServerCandidate } from '../schemas/rpc-server.js';
export declare function createDiscoverySwarm(): Hyperswarm;
export declare function destroyDiscoverySwarm(swarm: Hyperswarm): Promise<void>;
export declare function parseAnnouncement(line: string): string | undefined;
export declare function advertiseRpcServer(topic: string, url: string, createSwarm?: typeof createDiscoverySwarm): Promise<() => Promise<void>>;
export declare function discoverRpcEndpoints(topic: string, timeoutMs: number, ctx: RequestContext, deps?: {
    createSwarm?: typeof createDiscoverySwarm;
    probe?: typeof queryRpcInventory;
}): Promise<RpcServerCandidate[]>;
