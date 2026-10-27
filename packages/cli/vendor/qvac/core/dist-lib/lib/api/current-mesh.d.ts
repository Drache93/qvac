import type { Readable } from 'streamx';
import type { Mesh } from '../core/mesh.ts';
import { type WatchableOptions } from './watchable.ts';
export interface PoolRequest {
    readonly route?: string;
    readonly follow?: boolean;
    readonly chatId?: string | null;
    readonly chunkId?: string;
    readonly wide?: boolean;
}
export type MeshPool = (meshId: string, request?: PoolRequest) => Mesh | null | Promise<Mesh | null>;
export declare function requireMesh(pool: MeshPool, meshId: string, request?: PoolRequest): Promise<Mesh>;
export declare function heldMesh(pool: MeshPool, meshId: string, request?: PoolRequest): Promise<Mesh | null>;
export declare function meshWatchable<TRequest extends MeshScoped, TResult>(pool: MeshPool, query: (request: TRequest, mesh: Mesh) => Promise<TResult>, options: WatchableOptions): (request: TRequest) => Readable & AsyncIterable<TResult>;
export declare function routed(pool: MeshPool, route: string): MeshPool;
interface MeshScoped {
    readonly meshId: string;
    readonly chatId?: string | null;
}
export {};
