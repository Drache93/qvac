import { type AbortSignalLike } from '../../lib/helpers/race-abort.ts';
import { LanguageServer, type LspServerConfig, type SpawnServer } from './server.ts';
export interface PoolOptions {
    readonly idleMs: number;
    readonly startWaitMs: number;
    readonly spawn?: SpawnServer | undefined;
}
export interface UseAt {
    readonly config: LspServerConfig;
    readonly root: string;
    readonly signal?: AbortSignalLike | undefined;
}
export declare class ServerPool {
    private readonly _options;
    private readonly _entries;
    private _closed;
    constructor(options: PoolOptions);
    use<T>(at: UseAt, work: (server: LanguageServer) => Promise<T>): Promise<T>;
    close(): Promise<void>;
    private _start;
    private _started;
    private _forget;
    private _drop;
}
