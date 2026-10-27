import type { Core } from './core.ts';
import type { DeviceMetadata } from './core/mesh.ts';
import type { Logger } from './logger-type.ts';
import { Client, type ClientOptions } from './client.ts';
export interface AssistantClientOptions extends ClientOptions {
    logger?: Logger | null;
    sidecar?: boolean;
    storagePath: string;
    device?: DeviceMetadata;
    meshSeed?: Buffer;
    meshKey?: Buffer;
    bootstrapNodes?: ReadonlyArray<{
        host: string;
        port: number;
    }>;
    entry?: string;
}
export declare class AssistantClient extends Client {
    private readonly _inline;
    constructor({ sidecar: spawnSidecar, storagePath, device, meshSeed, meshKey, bootstrapNodes, entry, ...engineOptions }: AssistantClientOptions);
    get core(): Core | null;
    _close(): Promise<void>;
}
