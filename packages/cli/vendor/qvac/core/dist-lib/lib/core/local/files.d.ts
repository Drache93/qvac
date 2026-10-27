import type HyperDB from 'hyperdb';
import type { LocalFile } from '../../../spec/local/hyperschema/types.d.ts';
export type { LocalFile };
export type KnownFile = Omit<LocalFile, 'lastAccessed' | 'cleared'>;
export type FileKey = Pick<LocalFile, 'meshKey' | 'coreKey' | 'blockOffset'>;
type Locked = <T>(fn: () => Promise<T>) => Promise<T>;
export declare class LocalFiles {
    private readonly _db;
    private readonly _locked;
    constructor(db: HyperDB, locked: Locked);
    record(files: ReadonlyArray<KnownFile>, now?: number): Promise<void>;
    refresh(files: ReadonlyArray<KnownFile>): Promise<void>;
    read(file: KnownFile, now?: number): Promise<void>;
    touch(key: FileKey, now?: number): Promise<void>;
    private _write;
    markCleared(file: FileKey): Promise<void>;
    retireChats(meshKey: Buffer, purged: ReadonlyMap<string, number>): Promise<void>;
    forget(file: FileKey): Promise<void>;
    meshOf(coreKey: Buffer, blockOffset: number): Promise<Buffer | null>;
    backfilled(meshKey: Buffer): Promise<boolean>;
    markBackfilled(meshKey: Buffer): Promise<void>;
    list(meshKey?: Buffer): Promise<LocalFile[]>;
    live(meshKey?: Buffer): Promise<LocalFile[]>;
    stale(cutoff: number): Promise<LocalFile[]>;
}
export declare function dropMeshFileCursors(tx: HyperDB, meshKey: Buffer): Promise<void>;
export declare function backgroundSyncKey(meshKey: Buffer): string;
