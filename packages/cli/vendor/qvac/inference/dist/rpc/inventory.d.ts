import type { AbortSignal } from 'bare-abort-controller';
import type { DisposableScope } from '../runtime/disposable-scope.js';
import type { RpcServerCandidate } from '../schemas/rpc-server.js';
export type RpcInventory = Pick<RpcServerCandidate, 'devices' | 'rdmaAvailable'>;
export declare function queryRpcInventory(host: string, port: number, timeoutMs: number, signal: AbortSignal, scope?: DisposableScope): Promise<RpcInventory | undefined>;
